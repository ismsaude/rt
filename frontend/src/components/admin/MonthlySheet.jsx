import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Lock, LockOpen, PenLine, Printer, RotateCcw, Save, Sparkles } from 'lucide-react';
import { buildObservacoes } from '../../lib/monthlyReport';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import {
  calcAge, formatDate, formatDateTime, MESES, toDate, toISODate,
} from '../../lib/format';
import { CLINICAL_EVENT_TYPES, formatCouncil, SOCIAL_EVENT_TYPES } from '../../lib/clinical';
import {
  Alert, Badge, Button, Disclosure, MonthPicker, Signature, useConfirm, useToast,
} from '../ui';
import CloneSheetModal from './CloneSheetModal';
import SheetPhotos from './SheetPhotos';
import SignatureModal from '../SignatureModal';

const AUTONOMY_LEVELS = ['Independente', 'Semi-dependente', 'Dependente'];

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

/** Textarea que cresce com o conteúdo — evita barra de rolagem no PDF. */
function AutoTextarea({ value, onChange, placeholder, minRows = 2, readOnly = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="sheet-edit"
      rows={minRows}
      value={value}
      placeholder={readOnly ? '' : placeholder}
      onChange={onChange}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
    />
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

  // Intervenções: compromissos da agenda do morador no período.
  const eventosDoMes = useMemo(() => {
    if (!resident?.id) return [];
    return (events || [])
      .filter((ev) => {
        if (ev.resident_id !== resident.id) return false;
        const d = toDate(ev.date);
        return d && d.getFullYear() === year && d.getMonth() === month - 1;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [events, resident?.id, year, month]);

  const formatEvento = (ev) => {
    const d = toDate(ev.date);
    const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const partes = [ev.title];
    if (ev.location) partes.push(`Local: ${ev.location}`);
    if (ev.outcome) partes.push(ev.outcome);
    else if (ev.notes) partes.push(ev.notes);
    return `${dia}: ${partes.join('. ')}.`;
  };

  const eventosClinicos = useMemo(
    () => eventosDoMes.filter((ev) => !ev.type || CLINICAL_EVENT_TYPES.includes(ev.type)),
    [eventosDoMes]
  );

  const eventosSociais = useMemo(
    () => eventosDoMes.filter((ev) => SOCIAL_EVENT_TYPES.includes(ev.type)),
    [eventosDoMes]
  );

  const incidentesDoMes = useMemo(() => {
    if (!resident?.id) return [];
    return (incidents || [])
      .filter((inc) => {
        const ids = Array.isArray(inc.resident_ids) ? inc.resident_ids : [];
        if (!ids.includes(resident.id)) return false;
        const d = toDate(inc.occurred_at);
        return d && d.getFullYear() === year && d.getMonth() === month - 1;
      })
      .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
  }, [incidents, resident?.id, year, month]);

  const draftIntervencoes = () => {
    if (eventosClinicos.length === 0) {
      toast.warning('Nenhuma consulta, exame ou avaliação na agenda deste morador no período.');
      return;
    }
    setForm((f) => ({ ...f, intervencoes: eventosClinicos.map(formatEvento).join('\n') }));
  };

  const draftInteracoes = () => {
    if (eventosSociais.length === 0) {
      toast.warning('Nenhuma visita, passeio ou atividade coletiva registrada na agenda no período.');
      return;
    }
    setForm((f) => ({ ...f, interacoes: eventosSociais.map(formatEvento).join('\n') }));
  };

  const draftAdesao = () => {
    if (!summary || summary.totalPlantoes === 0) {
      toast.warning('Não há plantões registrados no período.');
      return;
    }
    const tomou = summary.meds.counts.tomou || 0;
    const recusou = summary.meds.counts.recusou || 0;
    const total = summary.totalPlantoes;

    const texto =
      recusou === 0
        ? `Boa adesão ao tratamento e às medicações. Medicação administrada sem recusa em ${tomou} dos ${total} plantões registrados no período.`
        : `Adesão com intercorrências: medicação administrada normalmente em ${tomou} plantões e recusada em ${recusou} ocasiões, de um total de ${total} plantões registrados no período.`;
    setForm((f) => ({ ...f, adesao: texto }));
  };

  const draftComportamento = () => {
    const alteracoes = summary?.behavior?.alteracoes || [];
    const observacoes = summary?.observacoes || [];

    if (alteracoes.length === 0 && observacoes.length === 0 && incidentesDoMes.length === 0) {
      toast.warning('Nada registrado sobre o comportamento deste morador no período.');
      return;
    }

    const blocos = [];
    const dia = (d) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (alteracoes.length === 0 && summary?.behavior?.semAlteracao > 0) {
      blocos.push(
        `Não foram observadas alterações de comportamento nos ${summary.behavior.semAlteracao} plantões em que o item foi avaliado.`
      );
    }

    alteracoes.forEach((alt) => {
      const dias = alt.dias.map((x) => dia(x.date)).join(', ');
      blocos.push(
        `${alt.label}: observada pela equipe em ${alt.count} ${alt.count === 1 ? 'plantão' : 'plantões'} (${dias}).`
      );
    });

    if (incidentesDoMes.length > 0) {
      blocos.push('');
      blocos.push('Intercorrências registradas no período:');
      incidentesDoMes.forEach((inc) => {
        const d = toDate(inc.occurred_at);
        const partes = [`${dia(d)}: ${inc.type} (${inc.severity}). ${inc.description}`];
        if (inc.conduct) partes.push(`Conduta: ${inc.conduct}`);
        blocos.push(partes.join(' '));
      });
    }

    if (observacoes.length > 0) {
      blocos.push('');
      blocos.push('Anotações das cuidadoras:');
      observacoes.forEach((o) => blocos.push(`${dia(o.date)}: ${o.text}`));
    }

    blocos.push('');
    blocos.push('[Revise e substitua pela sua leitura clínica do período.]');

    setForm((f) => ({ ...f, comportamento: blocos.join('\n') }));
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

  const divergeDoCadastro =
    (form.autonomia_higiene || '') !== (resident.autonomy_hygiene || '') ||
    (form.autonomia_alimentacao || '') !== (resident.autonomy_food || '') ||
    (form.autonomia_atividades || '') !== (resident.autonomy_activities || '');

  const idade = calcAge(resident.dateOfBirth);

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
            demais moradores do mesmo mês.
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
      <article className="sheet">
        <img src="/logo.png" alt="" className="sheet__watermark" aria-hidden="true" />

        <div className="sheet__logo-row">
          <img src="/logo.png" alt="Aurean Residência Terapêutica" className="sheet__logo" />
        </div>

        <h1 className="sheet__title">FICHA DE ACOMPANHAMENTO MENSAL</h1>

        <div className="sheet__meta">
          <div className="sheet__meta-row">
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">NOME:</span>
              <span className="sheet__meta-value">{resident.name}</span>
            </div>
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">DATA:</span>
              <span className="sheet__meta-value print-hide">
                <input
                  type="date"
                  className="sheet-select"
                  style={{ minWidth: '9.5rem' }}
                  value={form.emitido_em}
                  onChange={set('emitido_em')}
                  disabled={travada}
                  aria-label="Data de emissão da ficha"
                />
              </span>
              <span className="sheet__meta-value print-only">
                {formatDate(form.emitido_em)}
              </span>
            </div>
          </div>

          <div className="sheet__meta-row sheet__meta-row--triple">
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">DATA DE NASCIMENTO:</span>
              <span className="sheet__meta-value">{formatDate(resident.dateOfBirth)}</span>
            </div>
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">IDADE:</span>
              <span className="sheet__meta-value">{idade ?? '—'}</span>
            </div>
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">SEXO:</span>
              <span className="sheet__meta-value">
                {resident.sex || <span className="sheet__text--placeholder">não cadastrado</span>}
              </span>
            </div>
          </div>

          <div className="sheet__meta-row">
            <div className="sheet__meta-item">
              <span className="sheet__meta-label">PERÍODO DE REFERÊNCIA:</span>

              {/* Trocar o período aqui troca também o mês consolidado:
                  a ficha não pode declarar um mês e exibir os números
                  de outro. */}
              <span className="sheet__meta-value print-hide">
                <MonthPicker
                  value={monthKey}
                  onChange={(m) => onMonthChange?.(m)}
                  withData={months}
                  selectClassName="sheet-select"
                  ariaLabelMonth="Mês de referência da ficha"
                  ariaLabelYear="Ano de referência da ficha"
                />
              </span>
              <span className="sheet__meta-value print-only">{periodo}</span>
            </div>
          </div>
        </div>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            CONDIÇÕES CLÍNICAS E OBSERVAÇÕES
            <Button
              variant="ghost" size="sm" icon={RotateCcw}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={() => {
                setForm((f) => ({ ...f, observacoes: buildObservacoes(resident) }));
                toast.success('Resumo recarregado do cadastro do morador.');
              }}
            >
              Usar o cadastro
            </Button>
          </h2>
          <AutoTextarea
            value={form.observacoes}
            onChange={set('observacoes')}
            readOnly={travada}
            placeholder="Ex.: Morador de 67 anos, diabético, hipertensivo e esquizofrênico."
          />
        </section>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            INTERVENÇÕES REALIZADAS NO PERÍODO
            <Button
              variant="ghost" size="sm" icon={Sparkles}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={draftIntervencoes}
            >
              Gerar rascunho
            </Button>
          </h2>
          <AutoTextarea
            value={form.intervencoes}
            onChange={set('intervencoes')}
            readOnly={travada}
            placeholder="Ex.: 02/02: O morador passou por avaliação com a Dra. Camilla Rabuske, médica da família…"
            minRows={3}
          />
        </section>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            MUDANÇAS OBSERVADAS NO COMPORTAMENTO
            <Button
              variant="ghost" size="sm" icon={Sparkles}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={draftComportamento}
            >
              Reunir observações
            </Button>
          </h2>
          <AutoTextarea
            value={form.comportamento}
            onChange={set('comportamento')}
            readOnly={travada}
            placeholder="Ex.: Observa-se, por parte da equipe, que o residente apresentou…"
          />
        </section>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            ADESÃO AO TRATAMENTO
            <Button
              variant="ghost" size="sm" icon={Sparkles}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={draftAdesao}
            >
              Gerar rascunho
            </Button>
          </h2>
          <AutoTextarea
            value={form.adesao}
            onChange={set('adesao')}
            readOnly={travada}
            placeholder="Ex.: Boa adesão ao tratamento e às medicações."
          />
        </section>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            NÍVEL DE AUTONOMIA
            <Button
              variant="ghost" size="sm" icon={RotateCcw}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  autonomia_higiene: resident.autonomy_hygiene || '',
                  autonomia_alimentacao: resident.autonomy_food || '',
                  autonomia_atividades: resident.autonomy_activities || '',
                }));
                toast.success(`Autonomia recarregada do cadastro de ${resident.name}.`);
              }}
            >
              Usar o cadastro
            </Button>
          </h2>
          <div className="sheet__autonomy">
            {[
              ['Higiene pessoal:', 'autonomia_higiene'],
              ['Alimentação:', 'autonomia_alimentacao'],
              ['Atividades diárias:', 'autonomia_atividades'],
            ].map(([label, field]) => (
              <div className="sheet__autonomy-row" key={field}>
                <span className="sheet__autonomy-label">{label}</span>
                <select
                  className="sheet-select"
                  value={form[field]}
                  onChange={set(field)}
                  disabled={travada}
                >
                  <option value="">—</option>
                  {AUTONOMY_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </div>
            ))}
          </div>

          {divergeDoCadastro && (
            <div className="print-hide" style={{ marginTop: 'var(--space-3)' }}>
              <Alert tone="warning">
                Estes valores diferem do que está cadastrado para {resident.name}
                {' '}({[
                  resident.autonomy_hygiene,
                  resident.autonomy_food,
                  resident.autonomy_activities,
                ].filter(Boolean).join(' · ') || 'não avaliado'}).
                Se a autonomia mudou, atualize também a Central de Cadastros.
              </Alert>
            </div>
          )}
        </section>

        <section className="sheet__section">
          <h2 className="sheet__section-title">
            INTERAÇÕES SOCIAIS E FAMILIARES
            <Button
              variant="ghost" size="sm" icon={Sparkles}
              className={`print-hide ${travada ? 'u-sr-only' : ''}`}
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
              onClick={draftInteracoes}
            >
              Gerar rascunho
            </Button>
          </h2>
          <AutoTextarea
            value={form.interacoes}
            onChange={set('interacoes')}
            readOnly={travada}
            placeholder="Ex.: Neste mês foi realizado festividade de carnaval e churrasco para comemoração do aniversariante do mês."
          />
        </section>

        <SheetPhotos
          photos={form.photos}
          onChange={(photos) => setForm((f) => ({ ...f, photos }))}
          residentId={resident.id}
          monthKey={monthKey}
          readOnly={travada}
        />

        <div className="sheet__signature">
          {assinatura ? (
            <Signature assinatura={assinatura} />
          ) : (
            <>
              <div className="sheet__signature-line" />
              <div className="sheet__signature-name">{currentUser?.name || '—'}</div>
              <div className="sheet__signature-role">
                {currentUser?.job_title || 'Supervisora Residência Terapêutica'}
              </div>
              {formatCouncil(currentUser) && (
                <div className="sheet__signature-role">{formatCouncil(currentUser)}</div>
              )}
              <div className="sheet__signature-role print-hide" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                Ainda não assinada — use “Gerar relatório assinado”.
              </div>
            </>
          )}
        </div>
      </article>

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
