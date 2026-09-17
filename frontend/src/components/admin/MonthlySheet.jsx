import { useCallback, useEffect, useState } from 'react';
import { Copy, Lock, LockOpen, PenLine, Printer, Save } from 'lucide-react';
import { buildObservacoes } from '../../lib/monthlyReport';
import {
  draftAdesao, draftComportamento, draftIntervencoes, draftInteracoes,
} from '../../lib/sheetDrafts';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { formatDateTime, MESES, toISODate } from '../../lib/format';
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
  const [saving, setSaving] = useState(false);
  const [schemaOk, setSchemaOk] = useState(true);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [assinatura, setAssinatura] = useState(null);

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

    const { data, error } = await supabase
      .from('MonthlyReport')
      .select('*')
      .eq('resident_id', resident.id)
      .eq('month', monthKey)
      .maybeSingle();

    if (isMissingColumn(error)) {
      setSchemaOk(false);
      return;
    }
    setSchemaOk(true);
    setRecord(data || null);
    setAssinatura(data?.signed_by_name ? data : null);
    // Autonomia vem do cadastro do morador quando a ficha do mês
    // ainda não foi preenchida — evita redigitar um dado estável.
    setForm({
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
    });
  }, [resident, monthKey]);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

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

  /* ---------------- Gravação ---------------- */
  const save = async (assinaturaNova = null) => {
    setSaving(true);
    const payload = {
      ...form,
      ...(assinaturaNova || {}),
      resident_id: resident.id,
      resident_name: resident.name,
      month: monthKey,
      author_name: currentUser?.name || 'Supervisão',
      updated_at: new Date().toISOString(),
    };

    const { error } = record
      ? await supabase.from('MonthlyReport').update(payload).eq('id', record.id)
      : await supabase.from('MonthlyReport').insert([{ id: uid(), ...payload }]);

    setSaving(false);

    if (isMissingColumn(error)) {
      setSchemaOk(false);
      return;
    }
    if (error) {
      toast.error(`Erro ao salvar a ficha: ${error.message}`);
      return;
    }
    if (assinaturaNova) {
      setAssinatura(assinaturaNova);
      setSignOpen(false);
      toast.success('Ficha assinada e salva. Abrindo a impressão…');
      // Aguarda o React pintar a assinatura antes de chamar a impressão.
      setTimeout(() => window.print(), 600);
    } else {
      toast.success('Ficha mensal salva.');
    }
    load();
  };

  if (!resident) return null;

  return (
    <div>
      <div className="sheet-toolbar print-hide">
        <div className="u-row u-gap-3 u-wrap">
          {record ? (
            <Badge tone="success" dot>Salva em {formatDateTime(record.updated_at)}</Badge>
          ) : (
            <Badge tone="neutral" dot>Ainda não salva</Badge>
          )}
          {travada && (
            <Badge tone="primary" icon={Lock}>
              Assinada — somente leitura
            </Badge>
          )}

          <Disclosure title="Como usar">
            Clique em qualquer trecho da ficha para editar. Os botões{' '}
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
              <Button
                variant="secondary" size="sm" icon={Save}
                onClick={() => save()} loading={saving} disabled={!schemaOk}
              >
                Salvar
              </Button>
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
        onSigned={(a) => save(a)}
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
