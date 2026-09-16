import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardEdit, History, Send, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, ChipGroup,
  EmptyState, PageHeader, SelectField, Signature, SkeletonList, TextareaField,
  useToast,
} from './ui';
import { BEHAVIOR_NONE, BEHAVIOR_OPTIONS, behaviorTone } from '../lib/clinical';
import { saveIncidents } from '../lib/incidents';
import IncidentsSection from './IncidentsSection';
import SignatureModal from './SignatureModal';

/* Os rótulos abaixo são gravados no prontuário. Alterá-los muda o
   histórico: o classificador em lib/shiftReports.js normaliza as
   variações antigas para que os relatórios mensais sigam corretos. */
const HYGIENE_OPTIONS = ['Realizada', 'Parcial', 'Recusou o banho'];
const FOOD_OPTIONS = ['Comeu bem e bebeu água', 'Comeu pouco', 'Recusou alimentação'];
const MEDS_OPTIONS = ['Tomou normalmente', 'Recusou / Cuspiu', 'Não havia medicação no horário'];

const blankEntry = () => ({
  hygiene: HYGIENE_OPTIONS[0],
  food: FOOD_OPTIONS[0],
  meds: MEDS_OPTIONS[0],
  behavior: [BEHAVIOR_NONE],
  notes: '',
});


export default function ShiftHandover({ currentUser }) {
  const toast = useToast();

  const [residents, setResidents] = useState([]);
  const [entries, setEntries] = useState({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState([]);

  const [incidents, setIncidents] = useState([]);

  const [signOpen, setSignOpen] = useState(false);
  const [signError, setSignError] = useState('');

  const resetEntries = useCallback((list) => {
    const fresh = {};
    list.forEach((r) => { fresh[r.id] = blankEntry(); });
    setEntries(fresh);
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('ShiftReport').select('*')
      .order('date', { ascending: false }).limit(8);
    setHistory(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('Resident').select('*').order('name');
      if (error) {
        toast.error('Não foi possível carregar os moradores.');
      } else {
        setResidents(data || []);
        resetEntries(data || []);
      }
      await loadHistory();
      setLoading(false);
    })();
  }, [toast, resetEntries, loadHistory]);

  const update = (residentId, field, value) => {
    setEntries((prev) => ({
      ...prev,
      [residentId]: { ...prev[residentId], [field]: value },
    }));
  };

  const attentionCount = useMemo(
    () =>
      Object.values(entries).filter(
        (e) =>
          e?.hygiene === HYGIENE_OPTIONS[2] ||
          e?.food === FOOD_OPTIONS[2] ||
          e?.meds === MEDS_OPTIONS[1] ||
          (e?.behavior || []).some((b) => behaviorTone(b) === 'danger')
      ).length,
    [entries]
  );


  const startSigning = () => {
    if (!generalNotes.trim()) {
      toast.warning('Descreva o relato geral do plantão antes de finalizar.');
      return;
    }
    setSignError('');
    setSignOpen(true);
  };

  const submit = async (assinatura) => {
    setSignError('');
    setSaving(true);

    const now = assinatura.signed_at;

    const { data: saved, error } = await supabase.from('ShiftReport').insert([{
      reports: entries,
      general_notes: generalNotes.trim(),
      date: now,
      caregiver_id: currentUser?.id || 'dev-id',
      caregiver_name: assinatura.signed_by_name,
      ...assinatura,
    }]).select();

    if (error) {
      setSaving(false);
      setSignError(`Erro ao salvar: ${error.message}`);
      return;
    }

    if (incidents.length > 0) {
      const { error: incError } = await saveIncidents(incidents, {
        residents,
        author: { id: currentUser?.id, name: assinatura.signed_by_name },
        occurredAt: now,
        sourceId: saved?.[0]?.id || null,
      });
      if (incError) {
        setSaving(false);
        setSignError(
          `O plantão foi salvo, mas as intercorrências falharam: ${incError.message}. ` +
          'Avise a supervisão antes de sair.'
        );
        return;
      }
    }

    setSaving(false);
    setSignOpen(false);
    setSent(true);
    setGeneralNotes('');
    setIncidents([]);
    resetEntries(residents);
    loadHistory();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Passagem de plantão" description="Carregando moradores…" />
        <SkeletonList count={3} />
      </div>
    );
  }

  if (sent) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Plantão registrado com sucesso"
          description="O relatório foi assinado e arquivado no prontuário. Bom descanso!"
          action={<Button variant="secondary" onClick={() => setSent(false)}>Voltar ao formulário</Button>}
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Passagem de plantão"
        description="Registre como cada morador passou e as ocorrências da casa."
      />

      {attentionCount > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Alert tone="warning" title="Pontos de atenção neste plantão">
            {attentionCount === 1
              ? '1 morador com recusa registrada. Detalhe a ocorrência no campo de observação.'
              : `${attentionCount} moradores com recusa registrada. Detalhe as ocorrências nos campos de observação.`}
          </Alert>
        </div>
      )}

      {residents.length === 0 ? (
        <Card>
          <EmptyState
            icon={User}
            title="Nenhum morador cadastrado"
            description="A supervisão precisa cadastrar os moradores antes da primeira passagem de plantão."
          />
        </Card>
      ) : (
        <div className="u-stack u-gap-4">
          {residents.map((resident) => {
            const entry = entries[resident.id] || blankEntry();
            const hasAttention =
              entry.hygiene === HYGIENE_OPTIONS[2] ||
              entry.food === FOOD_OPTIONS[2] ||
              entry.meds === MEDS_OPTIONS[1] ||
              (entry.behavior || []).some((b) => behaviorTone(b) === 'danger');

            return (
              <Card key={resident.id} accent={hasAttention ? 'warning' : 'primary'}>
                <CardHeader>
                  <div className="u-row u-gap-3">
                    <Avatar name={resident.name} />
                    <div>
                      <div className="card__title">{resident.name}</div>
                      {resident.conditions && (
                        <div className="card__subtitle">{resident.conditions}</div>
                      )}
                    </div>
                  </div>
                  <div className="u-row u-gap-2" style={{ flexShrink: 0 }}>
                    {resident.allergies && (
                      <Badge tone="danger" icon={AlertTriangle}>
                        Alergia: {resident.allergies}
                      </Badge>
                    )}
                    {hasAttention && <Badge tone="warning" icon={AlertTriangle}>Atenção</Badge>}
                  </div>
                </CardHeader>

                <CardBody>
                  <div className="field-row" style={{ marginBottom: 'var(--space-4)' }}>
                    <SelectField
                      label="Higiene pessoal"
                      value={entry.hygiene}
                      onChange={(e) => update(resident.id, 'hygiene', e.target.value)}
                    >
                      {HYGIENE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </SelectField>

                    <SelectField
                      label="Alimentação e água"
                      value={entry.food}
                      onChange={(e) => update(resident.id, 'food', e.target.value)}
                    >
                      {FOOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </SelectField>

                    <SelectField
                      label="Medicações"
                      value={entry.meds}
                      onChange={(e) => update(resident.id, 'meds', e.target.value)}
                    >
                      {MEDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </SelectField>
                  </div>

                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
                      Comportamento observado
                    </span>
                    <ChipGroup
                      ariaLabel={`Comportamento de ${resident.name}`}
                      options={BEHAVIOR_OPTIONS}
                      exclusive={BEHAVIOR_NONE}
                      value={entry.behavior || []}
                      onChange={(next) => update(resident.id, 'behavior', next)}
                    />
                    <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                      Pode marcar mais de um. Isto alimenta a ficha mensal do morador.
                    </span>
                  </div>

                  <TextareaField
                    label="Observação específica"
                    hint="Humor, sono, queixas, visitas — o que a supervisão precisa saber."
                    placeholder={`Algo a registrar sobre ${String(resident.name).split(' ')[0]}?`}
                    value={entry.notes}
                    onChange={(e) => update(resident.id, 'notes', e.target.value)}
                    rows={2}
                  />
                </CardBody>
              </Card>
            );
          })}

          <IncidentsSection
            incidents={incidents}
            onChange={setIncidents}
            residents={residents}
          />

          <Card accent="warning">
            <CardHeader
              icon={AlertTriangle}
              title="Relato geral do plantão"
              subtitle="Campo obrigatório — vale como registro oficial da casa."
            />
            <CardBody>
              <TextareaField
                label="Ocorrências gerais"
                required
                hint="Incidentes, visitas, manutenção, intercorrências e qualquer fato relevante."
                placeholder="Descreva o que aconteceu durante o plantão…"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={5}
              />
            </CardBody>
          </Card>

          <Button variant="primary" size="xl" block icon={Send} onClick={startSigning} loading={saving}>
            Assinar e finalizar plantão
          </Button>
        </div>
      )}

      {/* ------------------------- Histórico ------------------------- */}
      <section className="section" style={{ marginTop: 'var(--space-12)' }}>
        <div className="section__header">
          <h2 className="section__title">
            <History size={18} aria-hidden="true" />
            Últimos plantões
          </h2>
          <p className="section__description">Acompanhe o que foi registrado pelos colegas.</p>
        </div>

        {history.length === 0 ? (
          <Card>
            <EmptyState icon={ClipboardEdit} title="Ainda não há plantões registrados" />
          </Card>
        ) : (
          <div className="list">
            {history.map((report) => (
              <Card key={report.id}>
                <CardBody tight>
                  <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="u-row u-gap-2">
                      <Avatar name={report.caregiver_name} size="sm" />
                      <strong style={{ fontSize: 'var(--text-md)' }}>{report.caregiver_name}</strong>
                    </div>
                    <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                      {formatDateTime(report.date)}
                    </span>
                  </div>

                  {report.general_notes && (
                    <p style={{ color: 'var(--text)', marginBottom: 'var(--space-3)' }}>
                      {report.general_notes}
                    </p>
                  )}

                  {report.signed_by_name && (
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <Signature assinatura={report} compact />
                    </div>
                  )}

                  <details>
                    <summary
                      style={{
                        cursor: 'pointer', fontSize: 'var(--text-sm)',
                        color: 'var(--primary-text)', fontWeight: 'var(--weight-semibold)',
                        display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                      }}
                    >
                      <ChevronDown size={14} /> Detalhes por morador
                    </summary>
                    <div className="u-stack u-gap-2" style={{ marginTop: 'var(--space-3)' }}>
                      {residents.map((res) => {
                        const data = report.reports?.[res.id];
                        if (!data) return null;
                        return (
                          <div
                            key={res.id}
                            style={{
                              padding: 'var(--space-3)',
                              background: 'var(--surface-sunken)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <strong style={{ fontSize: 'var(--text-sm)' }}>{res.name}</strong>
                            <div
                              className="u-row u-wrap u-gap-2"
                              style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)' }}
                            >
                              <Badge tone="neutral">Higiene: {data.hygiene}</Badge>
                              <Badge tone="neutral">Alimentação: {data.food}</Badge>
                              <Badge tone="neutral">Medicação: {data.meds}</Badge>
                            </div>
                            {data.notes && (
                              <p
                                style={{
                                  marginTop: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {data.notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSigned={submit}
        currentUser={currentUser}
        description="Confirme sua identidade para arquivar o relatório do plantão."
      >
        {incidents.length > 0 && (
          <Alert tone="warning">
            Serão registradas também{' '}
            <strong>
              {incidents.length === 1 ? '1 intercorrência' : `${incidents.length} intercorrências`}
            </strong>.
          </Alert>
        )}
        {signError && <Alert tone="danger">{signError}</Alert>}
      </SignatureModal>
    </div>
  );
}
