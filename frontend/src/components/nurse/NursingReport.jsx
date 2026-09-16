import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, ClipboardPlus, FileText, History, Send, Sparkles, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { formatDateTime, toISODate } from '../../lib/format';
import { NURSING_PROCEDURES, NURSING_SHIFTS } from '../../lib/clinical';
import { saveIncidents } from '../../lib/incidents';
import { buildNursingDraft, loadDayRecords } from '../../lib/nursingDraft';
import IncidentsSection from '../IncidentsSection';
import SignatureModal from '../SignatureModal';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, ChipGroup,
  EmptyState, PageHeader, SelectField, Signature, SkeletonList, TextareaField,
  useToast,
} from '../ui';

/** Turno provável a partir da hora, para poupar um toque. */
function turnoAtual() {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return 'Manhã';
  if (h >= 13 && h < 19) return 'Tarde';
  return 'Noite';
}

export default function NursingReport({ currentUser }) {
  const toast = useToast();

  const [residents, setResidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const [shift, setShift] = useState(turnoAtual);
  const [content, setContent] = useState('');
  const [procedures, setProcedures] = useState([]);
  const [residentNotes, setResidentNotes] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [drafting, setDrafting] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: res }, { data: reports, error }] = await Promise.all([
      supabase.from('Resident').select('id, name').order('name'),
      supabase.from('NursingReport').select('*').order('date', { ascending: false }).limit(10),
    ]);

    if (error && !/does not exist|schema cache/i.test(error.message || '')) {
      toast.error('Não foi possível carregar os relatórios anteriores.');
    }

    setResidents(res || []);
    setHistory(reports || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /**
   * Redige o relatório a partir do que já foi marcado hoje: sinais
   * aferidos, doses checadas e compromissos da agenda.
   */
  const gerarRascunho = async () => {
    setDrafting(true);
    const registros = await loadDayRecords(toISODate(new Date()));
    const { texto, procedimentos, resumo } = buildNursingDraft(registros, { residents });
    setDrafting(false);

    if (resumo.vazio) {
      toast.warning(
        'Nada foi registrado hoje ainda — sem sinais vitais, doses checadas ou compromissos.'
      );
      return;
    }

    setContent((atual) => (atual.trim() ? `${atual.trim()}\n\n${texto}` : texto));
    setProcedures((atuais) => Array.from(new Set([...atuais, ...procedimentos])));

    const partes = [];
    if (resumo.sinais) partes.push(`${resumo.sinais} aferição(ões)`);
    if (resumo.administradas) partes.push(`${resumo.administradas} dose(s) administrada(s)`);
    if (resumo.recusadas) partes.push(`${resumo.recusadas} recusa(s)`);
    if (resumo.compromissos) partes.push(`${resumo.compromissos} compromisso(s)`);
    toast.success(`Rascunho gerado a partir de ${partes.join(', ')}.`);
  };

  const jaFezHoje = history.some(
    (r) => toISODate(r.date) === toISODate(new Date()) && r.shift === shift
  );

  const abrirAssinatura = () => {
    if (!content.trim()) {
      toast.warning('Escreva a evolução de enfermagem antes de enviar.');
      return;
    }
    setSignOpen(true);
  };

  const submit = async (assinatura) => {
    setSaving(true);

    // Guarda só as observações realmente preenchidas.
    const notes = Object.fromEntries(
      Object.entries(residentNotes)
        .map(([id, txt]) => [id, String(txt || '').trim()])
        .filter(([, txt]) => txt)
    );

    const agora = assinatura.signed_at;

    const { data: saved, error } = await supabase.from('NursingReport').insert([{
      id: uid(),
      date: agora,
      shift,
      content: content.trim(),
      procedures,
      resident_notes: notes,
      author_id: currentUser?.id || null,
      author_name: assinatura.signed_by_name,
      ...assinatura,
    }]).select();

    if (error) {
      setSaving(false);
      toast.error(
        /does not exist|schema cache/i.test(error.message || '')
          ? 'A tabela NursingReport ainda não existe no banco. Rode a migração 006.'
          : `Erro ao salvar: ${error.message}`
      );
      return;
    }

    // As intercorrências viram registros próprios, ligados a este
    // relatório e a cada morador envolvido.
    const { error: incError } = await saveIncidents(incidents, {
      residents,
      author: { id: currentUser?.id, name: assinatura.signed_by_name },
      occurredAt: agora,
      sourceId: saved?.[0]?.id || null,
    });

    setSaving(false);

    if (incError) {
      toast.error(
        `O relatório foi salvo, mas as intercorrências falharam: ${incError.message}. ` +
        'Avise a supervisão antes de sair.'
      );
      return;
    }

    setSignOpen(false);
    setSent(true);
    setContent('');
    setProcedures([]);
    setResidentNotes({});
    setIncidents([]);
    load();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Relatório de enfermagem" description="Carregando…" />
        <SkeletonList count={3} />
      </div>
    );
  }

  if (sent) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Relatório registrado"
          description="A evolução de enfermagem foi arquivada e entra na ficha mensal dos moradores citados."
          action={<Button variant="secondary" onClick={() => setSent(false)}>Escrever outro</Button>}
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatório de enfermagem"
        description="A evolução do dia, mesmo quando não houve aferição de sinais vitais."
      />

      {jaFezHoje && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Alert tone="info">
            Já existe um relatório de hoje para o turno da {shift.toLowerCase()}.
            Enviar outro cria um registro adicional, sem substituir o anterior.
          </Alert>
        </div>
      )}

      <div className="u-stack u-gap-4">
        <Card>
          <CardHeader
            icon={ClipboardPlus}
            title="Evolução do período"
            subtitle="Use o rascunho para partir do que já foi registrado hoje."
            actions={
              <Button
                variant="secondary" size="sm" icon={Sparkles}
                onClick={gerarRascunho} loading={drafting}
              >
                Gerar rascunho
              </Button>
            }
          />
          <CardBody>
            <div className="u-stack u-gap-5">
              <SelectField
                label="Turno"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
              >
                {NURSING_SHIFTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>

              <TextareaField
                label="Evolução de enfermagem"
                required
                hint="Estado geral da casa, condutas, intercorrências clínicas, contatos com a rede."
                placeholder="Descreva como transcorreu o período do ponto de vista da enfermagem…"
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              <div>
                <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
                  Procedimentos realizados
                </span>
                <ChipGroup
                  ariaLabel="Procedimentos realizados"
                  options={NURSING_PROCEDURES}
                  value={procedures}
                  onChange={setProcedures}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={User}
            title="Observações por morador"
            subtitle="Opcional. O que você escrever aqui entra na ficha mensal daquele morador."
          />
          <CardBody>
            {residents.length === 0 ? (
              <EmptyState icon={User} title="Nenhum morador cadastrado" />
            ) : (
              <div className="u-stack u-gap-4">
                {residents.map((r) => (
                  <TextareaField
                    key={r.id}
                    label={r.name}
                    rows={2}
                    placeholder={`Algo de enfermagem sobre ${String(r.name).split(' ')[0]}?`}
                    value={residentNotes[r.id] || ''}
                    onChange={(e) =>
                      setResidentNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <IncidentsSection
          incidents={incidents}
          onChange={setIncidents}
          residents={residents}
        />

        <Button variant="primary" size="xl" block icon={Send} onClick={abrirAssinatura} loading={saving}>
          Assinar e enviar relatório
          {incidents.length > 0 &&
            ` e ${incidents.length === 1 ? '1 intercorrência' : `${incidents.length} intercorrências`}`}
        </Button>
      </div>

      {/* ------------------------- Histórico ------------------------- */}
      <section className="section" style={{ marginTop: 'var(--space-12)' }}>
        <div className="section__header">
          <h2 className="section__title">
            <History size={18} aria-hidden="true" />
            Relatórios anteriores
          </h2>
        </div>

        {history.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="Nenhum relatório ainda"
              description="O primeiro relatório de enfermagem aparecerá aqui."
            />
          </Card>
        ) : (
          <div className="list">
            {history.map((r) => {
              const notas = r.resident_notes && typeof r.resident_notes === 'object'
                ? Object.entries(r.resident_notes)
                : [];
              return (
                <Card key={r.id}>
                  <CardBody tight>
                    <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-2)' }}>
                      <div className="u-row u-gap-2">
                        <Avatar name={r.author_name} size="sm" />
                        <strong style={{ fontSize: 'var(--text-md)' }}>{r.author_name}</strong>
                        {r.shift && <Badge tone="neutral">{r.shift}</Badge>}
                      </div>
                      <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatDateTime(r.date)}
                      </span>
                    </div>

                    <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{r.content}</p>

                    {r.signed_by_name && (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <Signature assinatura={r} compact />
                      </div>
                    )}

                    {Array.isArray(r.procedures) && r.procedures.length > 0 && (
                      <div className="u-row u-wrap u-gap-1" style={{ marginTop: 'var(--space-3)' }}>
                        {r.procedures.map((p) => (
                          <Badge key={p} tone="primary">{p}</Badge>
                        ))}
                      </div>
                    )}

                    {notas.length > 0 && (
                      <div
                        style={{
                          marginTop: 'var(--space-3)',
                          paddingTop: 'var(--space-3)',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        {notas.map(([id, txt]) => (
                          <p key={id} style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                            <strong>{residents.find((x) => x.id === id)?.name || 'Morador'}:</strong>{' '}
                            <span className="u-muted">{txt}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSigned={submit}
        currentUser={currentUser}
        description="Confirme sua identidade para arquivar a evolução de enfermagem."
      >
        {incidents.length > 0 && (
          <Alert tone="warning">
            Serão registradas também{' '}
            <strong>
              {incidents.length === 1 ? '1 intercorrência' : `${incidents.length} intercorrências`}
            </strong>.
          </Alert>
        )}
      </SignatureModal>
    </div>
  );
}
