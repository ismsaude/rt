import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, CloudOff, Copy, Loader2, Lock, LockOpen, PenLine, Printer, RotateCw,
} from 'lucide-react';
import { buildObservacoes } from '../../lib/monthlyReport';
import {
  draftAdesao, draftComportamento, draftIntervencoes, draftInteracoes,
} from '../../lib/sheetDrafts';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { formatDateTime, formatTime, MESES, toDate, toISODate } from '../../lib/format';
import {
  Alert, Badge, Button, Disclosure, useConfirm, useToast,
} from '../ui';
import CloneSheetModal from './CloneSheetModal';
import SheetDocument from './SheetDocument';
import SignatureModal from '../SignatureModal';

const EMPTY = {
  emitido_em: '',
  photos: [],
  observacoes: '',
  intervencoes: '',
  comportamento: '',
  adesao: '',
  autonomia_higiene: '',
  autonomia_alimentacao: '',
  autonomia_atividades: '',
  interacoes: '',
};

/* Silêncio no teclado que dispara a gravação. Curto o bastante para
   que nada se perca se o celular travar ou a aba fechar; longo o
   bastante para não mandar uma escrita por tecla digitada. */
const ESPERA_ANTES_DE_GRAVAR = 1200;

/** "09:46" no mesmo dia; com a data quando a gravação é mais antiga. */
function horaDaGravacao(valor) {
  const d = toDate(valor);
  if (!d) return '';
  return d.toDateString() === new Date().toDateString()
    ? formatTime(d)
    : formatDateTime(d);
}

/** "morador|mês" — identifica a ficha a que um texto pertence. */
const chaveDaFicha = (residentId, monthKey) => `${residentId}|${monthKey}`;

function isMissingColumn(error) {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .* does not exist|schema cache/i.test(error.message || '')
  );
}

export default function MonthlySheet({
  resident, monthKey, onMonthChange, months = [], summary, events, incidents,
  residents = [], currentUser,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState(EMPTY);
  const [record, setRecord] = useState(null);
  /* salvo | editando | salvando | erro — é o que a tarja no alto informa. */
  const [estado, setEstado] = useState('salvo');
  const [schemaOk, setSchemaOk] = useState(true);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [assinatura, setAssinatura] = useState(null);

  /* ---------------- Gravação contínua ----------------
     A ficha é prontuário e se escreve aos poucos, quase sempre no
     celular. Esperar o clique em "Salvar" é apostar que nada acontece
     no intervalo — aba fechada, bateria no fim, 4G caindo. Então o que
     for digitado vai para o banco sozinho, pouco depois da última tecla.

     O texto pendente carrega consigo o morador e o mês a que pertence:
     trocar de ficha no meio da digitação não pode fazer o parágrafo de
     um morador cair na ficha de outro. */
  const idsRef = useRef(new Map());   // chave da ficha → id já gravado
  const baseRef = useRef('');         // o form como está no banco
  const fichaRef = useRef('');        // a ficha que o form na tela representa
  const cargaRef = useRef('');        // última carga pedida, contra respostas atrasadas
  const pendenteRef = useRef(null);   // o que foi digitado e ainda não gravado
  const filaRef = useRef(Promise.resolve());
  const avisouFalhaRef = useRef(false);

  /* Ficha assinada não se altera: o texto impresso precisa ser
     exatamente o que foi assinado. Só o acesso de desenvolvimento
     destrava, e destravar apaga a assinatura — ver destravar(). */
  const ehDesenvolvedor = currentUser?.email === 'dev@aurean.com';
  const travada = !!assinatura;

  const [year, month] = monthKey.split('-').map(Number);
  const periodo = `${MESES[month - 1]} de ${year}`;

  /* ---------------- Carregamento ---------------- */
  const load = useCallback(async () => {
    if (!resident?.id) return;

    const chave = chaveDaFicha(resident.id, monthKey);
    cargaRef.current = chave;
    fichaRef.current = '';   // enquanto carrega, nada na tela vale como texto da ficha

    const { data, error } = await supabase
      .from('MonthlyReport')
      .select('*')
      .eq('resident_id', resident.id)
      .eq('month', monthKey)
      .maybeSingle();

    // Resposta de uma ficha que já não está na tela não manda em nada.
    if (cargaRef.current !== chave) return;

    if (isMissingColumn(error)) {
      setSchemaOk(false);
      return;
    }
    setSchemaOk(true);
    setRecord(data || null);
    setAssinatura(data?.signed_by_name ? data : null);
    idsRef.current.set(chave, data?.id || null);

    // Autonomia vem do cadastro do morador quando a ficha do mês
    // ainda não foi preenchida — evita redigitar um dado estável.
    const carregado = {
      // Data que sai no documento: a supervisão pode ajustar, já que
      // a ficha nem sempre é emitida no mesmo dia em que foi redigida.
      emitido_em: data?.emitido_em || toISODate(new Date()),
      photos: Array.isArray(data?.photos) ? data.photos : [],
      // O resumo clínico vem do cadastro quando a ficha ainda não o tem:
      // é a mesma informação em todas as fichas daquele morador.
      observacoes: data?.observacoes || buildObservacoes(resident),
      intervencoes: data?.intervencoes || '',
      comportamento: data?.comportamento || '',
      adesao: data?.adesao || '',
      autonomia_higiene: data?.autonomia_higiene || resident.autonomy_hygiene || '',
      autonomia_alimentacao: data?.autonomia_alimentacao || resident.autonomy_food || '',
      autonomia_atividades: data?.autonomia_atividades || resident.autonomy_activities || '',
      interacoes: data?.interacoes || '',
    };
    setForm(carregado);
    /* O que veio do cadastro ainda não é ficha gravada, mas também não
       é digitação da supervisão: só grava quando ela escrever algo. */
    baseRef.current = JSON.stringify(carregado);
    fichaRef.current = chave;
    setEstado('salvo');
  }, [resident, monthKey]);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  /* ---------------- Gravação ---------------- */
  const gravar = useCallback(async function gravar(pendente, assinaturaNova = null) {
    const { chave, snapshot, resident: r, monthKey: mk } = pendente;
    const naTela = () => fichaRef.current === chave;

    if (naTela()) setEstado('salvando');

    const payload = {
      ...snapshot,
      ...(assinaturaNova || {}),
      resident_id: r.id,
      resident_name: r.name,
      month: mk,
      author_name: currentUser?.name || 'Supervisão',
      updated_at: new Date().toISOString(),
    };

    const id = idsRef.current.get(chave);
    const tabela = supabase.from('MonthlyReport');
    const { data, error } = id
      ? await tabela.update(payload).eq('id', id).select().maybeSingle()
      : await tabela.insert([{ id: uid(), ...payload }]).select().maybeSingle();

    if (isMissingColumn(error)) {
      pendenteRef.current = null;   // insistir não resolve: falta coluna no banco
      if (naTela()) {
        setSchemaOk(false);
        setEstado('salvo');
      }
      return { error };
    }

    if (error) {
      // O que foi escrito não pode sumir: volta para a fila.
      if (!pendenteRef.current) pendenteRef.current = pendente;
      if (naTela()) setEstado('erro');
      if (!avisouFalhaRef.current) {
        avisouFalhaRef.current = true;
        toast.error(`Não foi possível salvar a ficha: ${error.message}`);
      }
      return { error };
    }

    // O id guardado não existe mais (ficha apagada em outro lugar):
    // refaz a gravação, agora como inserção.
    if (!data && id) {
      idsRef.current.delete(chave);
      return gravar(pendente, assinaturaNova);
    }

    avisouFalhaRef.current = false;
    if (data?.id) idsRef.current.set(chave, data.id);

    if (naTela()) {
      setRecord(data || null);
      baseRef.current = JSON.stringify(snapshot);
      // Se a supervisão seguiu digitando, o que veio depois ainda espera.
      setEstado(pendenteRef.current ? 'editando' : 'salvo');
    }
    return { data };
  }, [currentUser?.name, toast]);

  /* Uma gravação por vez: duas em paralelo criariam dois registros
     para o mesmo morador e mês. */
  const enfileirar = useCallback((pendente, assinaturaNova = null) => {
    const gravacao = filaRef.current.then(() => gravar(pendente, assinaturaNova));
    filaRef.current = gravacao.catch(() => {});
    return gravacao;
  }, [gravar]);

  const enviarPendente = useCallback(() => {
    const pendente = pendenteRef.current;
    if (!pendente) return null;
    pendenteRef.current = null;
    return enfileirar(pendente);
  }, [enfileirar]);

  /* Versão de identidade fixa, para ouvintes do navegador e para a
     limpeza de efeitos, que não podem se refazer a cada tecla. */
  const enviarPendenteRef = useRef(() => null);
  useEffect(() => { enviarPendenteRef.current = enviarPendente; });
  const salvarPendente = useCallback(() => enviarPendenteRef.current(), []);

  /* Cada parada no teclado vira uma gravação. */
  useEffect(() => {
    if (!schemaOk || travada) return undefined;
    if (!resident?.id || fichaRef.current !== chaveDaFicha(resident.id, monthKey)) return undefined;
    if (JSON.stringify(form) === baseRef.current) return undefined;

    pendenteRef.current = { chave: fichaRef.current, snapshot: form, resident, monthKey };
    setEstado((e) => (e === 'salvando' || e === 'erro' ? e : 'editando'));

    const timer = setTimeout(salvarPendente, ESPERA_ANTES_DE_GRAVAR);
    return () => clearTimeout(timer);
  }, [form, resident, monthKey, schemaOk, travada, salvarPendente]);

  /* Trocar de morador, de mês ou sair da tela não pode engolir o que
     estava escrito: o pendente vai antes. */
  useEffect(() => () => { salvarPendente(); }, [resident?.id, monthKey, salvarPendente]);

  /* No celular, sair do aplicativo congela a aba — grava ao esconder.
     Se o navegador for fechado com algo por gravar, avisa. E quando a
     conexão volta, manda o que ficou preso. */
  useEffect(() => {
    const aoEsconder = () => { if (document.hidden) salvarPendente(); };
    const aoFechar = (e) => {
      if (!pendenteRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('beforeunload', aoFechar);
    window.addEventListener('online', salvarPendente);
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('beforeunload', aoFechar);
      window.removeEventListener('online', salvarPendente);
    };
  }, [salvarPendente]);

  /** Retentativa depois de uma falha: manda sem esperar o intervalo. */
  const salvarAgora = async () => {
    const gravacao = salvarPendente();
    if (!gravacao) {
      setEstado('salvo');
      return;
    }
    const { error } = await gravacao;
    if (!error) toast.success('Ficha mensal salva.');
  };

  const assinar = async (assinaturaNova) => {
    // O que está na tela vai junto da assinatura, numa gravação só.
    pendenteRef.current = null;
    const pendente = {
      chave: chaveDaFicha(resident.id, monthKey), snapshot: form, resident, monthKey,
    };
    const { data, error } = await enfileirar(pendente, assinaturaNova);
    if (error) return;

    setAssinatura(data?.signed_by_name ? data : assinaturaNova);
    setSignOpen(false);
    toast.success('Ficha assinada e salva. Abrindo a impressão…');
    // Aguarda o React pintar a assinatura antes de chamar a impressão.
    setTimeout(() => window.print(), 600);
  };

  const destravar = async () => {
    const ok = await confirm({
      title: 'Destravar a ficha',
      message: `A assinatura de ${assinatura.signed_by_name} será removida e a ficha volta a ser editável.`,
      warning:
        'Um documento não pode ser alterado depois de assinado sem que a assinatura caia junto — ' +
        'senão passaria a afirmar algo que ninguém assinou. Após editar, será preciso assinar de novo.',
      confirmLabel: 'Destravar e remover assinatura',
    });
    if (!ok) return;

    const limpo = {
      signed_by_name: null, signed_by_role: null, signed_council: null,
      signed_at: null, signed_ip: null, signed_device: null,
    };

    const { error } = await supabase
      .from('MonthlyReport').update(limpo).eq('id', record.id);

    if (error) {
      toast.error('Não foi possível destravar a ficha.');
      return;
    }
    setAssinatura(null);
    toast.success('Ficha destravada. A assinatura foi removida.');
    load();
  };

  /* ---------------- Rascunhos a partir dos dados ---------------- */
  const residentId = resident?.id;

  const drafts = {
    observacoes: () => {
      setForm((f) => ({ ...f, observacoes: buildObservacoes(resident) }));
      toast.success('Resumo recarregado do cadastro do morador.');
    },
    intervencoes: () => {
      const texto = draftIntervencoes({ events, residentId, monthKey });
      if (!texto) {
        toast.warning('Nenhuma consulta, exame ou avaliação na agenda deste morador no período.');
        return;
      }
      setForm((f) => ({ ...f, intervencoes: texto }));
    },
    interacoes: () => {
      const texto = draftInteracoes({ events, residentId, monthKey });
      if (!texto) {
        toast.warning('Nenhuma visita, passeio ou atividade coletiva registrada na agenda no período.');
        return;
      }
      setForm((f) => ({ ...f, interacoes: texto }));
    },
    adesao: () => {
      const texto = draftAdesao({ summary });
      if (!texto) {
        toast.warning('Não há plantões registrados no período.');
        return;
      }
      setForm((f) => ({ ...f, adesao: texto }));
    },
    comportamento: () => {
      const texto = draftComportamento({ summary, incidents, residentId, monthKey });
      if (!texto) {
        toast.warning('Nada registrado sobre o comportamento deste morador no período.');
        return;
      }
      setForm((f) => ({ ...f, comportamento: texto }));
    },
    autonomia: () => {
      setForm((f) => ({
        ...f,
        autonomia_higiene: resident.autonomy_hygiene || '',
        autonomia_alimentacao: resident.autonomy_food || '',
        autonomia_atividades: resident.autonomy_activities || '',
      }));
      toast.success(`Autonomia recarregada do cadastro de ${resident.name}.`);
    },
  };

  if (!resident) return null;

  return (
    <div>
      <div className="sheet-toolbar print-hide">
        <div className="u-row u-gap-3 u-wrap">
          {estado === 'erro' ? (
            <span className="sheet-status sheet-status--erro">
              <CloudOff size={14} aria-hidden="true" />
              Não foi possível salvar
            </span>
          ) : estado === 'salvando' || estado === 'editando' ? (
            <span className="sheet-status sheet-status--ativo">
              <Loader2 size={14} className="sheet-status__girando" aria-hidden="true" />
              Salvando…
            </span>
          ) : record ? (
            <span className="sheet-status sheet-status--salvo">
              <CheckCircle2 size={14} aria-hidden="true" />
              Salvo automaticamente {horaDaGravacao(record.updated_at)}
            </span>
          ) : (
            <span className="sheet-status sheet-status--ativo">
              <PenLine size={14} aria-hidden="true" />
              Salva sozinha enquanto você escreve
            </span>
          )}
          {travada && (
            <Badge tone="primary" icon={Lock}>
              Assinada — somente leitura
            </Badge>
          )}

          <Disclosure title="Como usar">
            Clique em qualquer trecho da ficha para editar. O que for escrito é{' '}
            <strong>salvo sozinho</strong>, segundos depois da última tecla — a
            tarja ao lado mostra a hora da última gravação. Não há botão de
            salvar: só aparece um, para tentar de novo, se a gravação falhar. Os botões{' '}
            <strong>Gerar rascunho</strong> preenchem a seção a partir do que já
            está registrado no sistema — revise antes de emitir.{' '}
            <strong>Gerar relatório assinado</strong> confirma sua senha, salva a
            ficha e abre a impressão: escolha <em>Salvar como PDF</em> no destino.{' '}
            <strong>Copiar para outros</strong> leva as seções da casa para os
            demais moradores do mesmo mês. Para resolver o mês inteiro de uma vez,
            use <strong>Fechar o mês</strong>, no alto da página.
          </Disclosure>
        </div>

        <div className="u-row u-gap-2">
          {travada ? (
            <>
              {ehDesenvolvedor && (
                <Button variant="ghost" size="sm" icon={LockOpen} onClick={destravar}>
                  Destravar
                </Button>
              )}
              <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
                Visualizar PDF
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost" size="sm" icon={Copy}
                onClick={() => setCloneOpen(true)}
                disabled={!schemaOk || residents.length < 2}
              >
                Copiar para outros
              </Button>
              {/* A gravação é automática; o botão só aparece quando ela falha. */}
              {estado === 'erro' && (
                <Button
                  variant="secondary" size="sm" icon={RotateCw}
                  onClick={salvarAgora} disabled={!schemaOk}
                >
                  Tentar de novo
                </Button>
              )}
              <Button
                variant="primary" size="sm" icon={PenLine}
                onClick={() => setSignOpen(true)} disabled={!schemaOk}
              >
                Gerar relatório assinado
              </Button>
            </>
          )}
        </div>
      </div>

      {travada && (
        <div className="print-hide" style={{ maxWidth: 820, margin: '0 auto var(--space-4)' }}>
          <Alert tone="info" title="Ficha assinada">
            O conteúdo não pode mais ser alterado: o documento impresso precisa ser
            exatamente o que foi assinado por {assinatura.signed_by_name}.
            {ehDesenvolvedor
              ? ' Use "Destravar" para editar — a assinatura será removida e a ficha precisará ser assinada de novo.'
              : ' Para corrigir algo, peça ao responsável técnico do sistema.'}
          </Alert>
        </div>
      )}

      {estado === 'erro' && (
        <div className="print-hide" style={{ maxWidth: 820, margin: '0 auto var(--space-4)' }}>
          <Alert tone="danger" title="O texto ainda não chegou ao banco">
            O que você escreveu continua na tela e será gravado assim que a conexão
            voltar. Não feche a página sem ver a tarja de ficha salva — se precisar,
            use <strong>Tentar de novo</strong>.
          </Alert>
        </div>
      )}

      {!schemaOk && (
        <div className="print-hide" style={{ maxWidth: 820, margin: '0 auto var(--space-4)' }}>
          <Alert tone="warning" title="Banco ainda sem as colunas da ficha">
            A ficha pode ser preenchida e impressa, mas não será arquivada. Rode a
            migração <code>supabase/migrations/002_ficha_mensal.sql</code> para
            habilitar a gravação.
          </Alert>
        </div>
      )}

      {/* ==================== A FICHA ==================== */}
      <SheetDocument
        resident={resident}
        monthKey={monthKey}
        form={form}
        assinatura={assinatura}
        currentUser={currentUser}
        edit={{
          travada,
          set,
          months,
          onMonthChange,
          onPhotos: (photos) => setForm((f) => ({ ...f, photos })),
          drafts,
        }}
      />

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSigned={assinar}
        currentUser={currentUser}
        title="Assinar e emitir a ficha"
        description={`Ficha de ${resident?.name} — ${periodo}.`}
      >
        <Alert tone="info">
          Ao assinar, a ficha é salva e a janela de impressão abre em seguida.
          Escolha <strong>Salvar como PDF</strong> no destino.
        </Alert>
      </SignatureModal>

      <CloneSheetModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        origem={form}
        monthKey={monthKey}
        resident={resident}
        residents={residents}
        currentUser={currentUser}
        onDone={load}
      />
    </div>
  );
}
