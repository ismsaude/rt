import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarDays, Check, CheckCircle2, ClipboardList,
  Droplets, Eye, FileText, LayoutDashboard, MessageSquareText, Pill, Printer,
  RefreshCw, Save, Siren, Sparkles, Trash2, User, Utensils,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import MonthlySheet from './MonthlySheet';
import { behaviorTone, severityTone } from '../../lib/clinical';
import {
  firstName, formatDate, formatDateTime, formatDayMonth, formatMonthLabel,
  formatTime, formatWeekday, toDate, toISODate, toMonthKey,
} from '../../lib/format';
import {
  availableMonths, buildMonthlySummary, draftNarrative, groupEntriesByDay,
  scanGeneralNotes, shiftLabel, classifyFood, classifyHygiene, classifyMeds,
  FOOD_LABELS, HYGIENE_LABELS, MEDS_LABELS,
} from '../../lib/shiftReports';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field,
  Meter, MonthPicker, PageHeader, Segmented, SelectField, SkeletonList,
  StackedMeter, Stat, StatGrid, Tabs, TextareaField, Timeline, TimelineItem,
  useConfirm, useToast,
} from '../ui';

/** A tabela de parecer mensal é opcional: o sistema funciona sem ela. */
function isMissingTable(error) {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    /does not exist|schema cache|could not find the table/i.test(error.message || '')
  );
}

export default function ResidentReports({ currentUser }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('mensal');
  const [residents, setResidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Visão diária
  const [dayFilter, setDayFilter] = useState(toISODate(new Date()));

  // Consolidado mensal
  const [monthView, setMonthView] = useState('ficha');
  const [onlyWritten, setOnlyWritten] = useState(false);
  const [showGeneral, setShowGeneral] = useState(true);
  const [residentId, setResidentId] = useState('');
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [narrative, setNarrative] = useState('');
  const [storedNarrative, setStoredNarrative] = useState(null);
  const [narrativeTable, setNarrativeTable] = useState(true);
  const [savingNarrative, setSavingNarrative] = useState(false);

  /* ----------------------------- Dados ----------------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: res, error: resError },
      { data: shifts, error: shiftError },
      { data: evs },
      { data: incs },
    ] = await Promise.all([
      supabase.from('Resident').select('*').order('name'),
      supabase.from('ShiftReport').select('*').order('date', { ascending: false }),
      supabase.from('Event').select('*'),
      supabase.from('Incident').select('*').order('occurred_at', { ascending: false }),
    ]);

    if (resError || shiftError) toast.error('Não foi possível carregar os relatórios.');

    setResidents(res || []);
    setReports(shifts || []);
    setEvents(evs || []);
    setIncidents(incs || []);
    if (res?.length) setResidentId((prev) => prev || res[0].id);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => availableMonths(reports), [reports]);

  const resident = useMemo(
    () => residents.find((r) => r.id === residentId),
    [residents, residentId]
  );

  const summary = useMemo(
    () => (residentId ? buildMonthlySummary(reports, residentId, monthKey) : null),
    [reports, residentId, monthKey]
  );

  const suggestion = useMemo(
    () => (summary ? draftNarrative(summary, resident?.name || 'o morador') : ''),
    [summary, resident]
  );

  const days = useMemo(
    () => (summary ? groupEntriesByDay(summary.entries) : []),
    [summary]
  );

  const incidentesDoMorador = useMemo(() => {
    if (!residentId) return [];
    const [y, mo] = monthKey.split('-').map(Number);
    return incidents
      .filter((inc) => {
        const ids = Array.isArray(inc.resident_ids) ? inc.resident_ids : [];
        if (!ids.includes(residentId)) return false;
        const d = toDate(inc.occurred_at);
        return d && d.getFullYear() === y && d.getMonth() === mo - 1;
      })
      .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
  }, [incidents, residentId, monthKey]);

  const daysToRead = useMemo(
    () => (onlyWritten ? days.filter((d) => d.hasWriting) : days),
    [days, onlyWritten]
  );

  const daysWithWriting = useMemo(() => days.filter((d) => d.hasWriting).length, [days]);

  /* ------------------ Parecer salvo da supervisora ------------------ */
  const loadNarrative = useCallback(async () => {
    if (!residentId) return;

    const { data, error } = await supabase
      .from('MonthlyReport')
      .select('*')
      .eq('resident_id', residentId)
      .eq('month', monthKey)
      .maybeSingle();

    if (isMissingTable(error)) {
      setNarrativeTable(false);
      setStoredNarrative(null);
      setNarrative('');
      return;
    }

    setNarrativeTable(true);
    setStoredNarrative(data || null);
    setNarrative(data?.narrative || '');
  }, [residentId, monthKey]);

  useEffect(() => { loadNarrative(); }, [loadNarrative]);

  const saveNarrative = async () => {
    if (!narrative.trim()) {
      toast.warning('Escreva o parecer antes de salvar.');
      return;
    }

    setSavingNarrative(true);
    const payload = {
      resident_id: residentId,
      resident_name: resident?.name || '',
      month: monthKey,
      narrative: narrative.trim(),
      author_name: currentUser?.name || 'Supervisão',
      updated_at: new Date().toISOString(),
    };

    const { error } = storedNarrative
      ? await supabase.from('MonthlyReport').update(payload).eq('id', storedNarrative.id)
      : await supabase.from('MonthlyReport').insert([{ id: uid(), ...payload }]);

    setSavingNarrative(false);

    if (isMissingTable(error)) {
      setNarrativeTable(false);
      return;
    }
    if (error) {
      toast.error(`Erro ao salvar o parecer: ${error.message}`);
      return;
    }
    toast.success('Parecer mensal salvo.');
    loadNarrative();
  };

  /* --------------------------- Visão diária --------------------------- */
  const reportsOfDay = useMemo(
    () => reports.filter((r) => String(r.date).startsWith(dayFilter)),
    [reports, dayFilter]
  );

  const deleteReport = async (report) => {
    const ok = await confirm({
      title: 'Apagar registro de plantão',
      message: `O plantão de ${formatDateTime(report.date)}, assinado por ${report.caregiver_name}, será apagado.`,
      warning:
        'Prontuário não deveria ser apagado: a exclusão é permanente e não deixa rastro de quem removeu. Considere manter o registro.',
      confirmLabel: 'Apagar definitivamente',
    });
    if (!ok) return;

    const { error } = await supabase.from('ShiftReport').delete().eq('id', report.id);
    if (error) {
      toast.error('Erro ao apagar o registro.');
      return;
    }
    toast.success('Registro apagado.');
    load();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Relatórios" description="Carregando…" />
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Evolução e relatórios"
        description="Consolidação dos plantões para acompanhamento e auditoria."
        actions={
          <Button variant="secondary" icon={Printer} onClick={() => window.print()} className="print-hide">
            Imprimir
          </Button>
        }
      />

      <div className="print-hide" style={{ marginBottom: 'var(--space-6)' }}>
        <Tabs
          ariaLabel="Tipo de relatório"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mensal', label: 'Consolidado mensal por morador', icon: FileText },
            { value: 'diario', label: 'Plantões do dia', icon: CalendarDays },
          ]}
        />
      </div>

      {/* ================= CONSOLIDADO MENSAL ================= */}
      {tab === 'mensal' && (
        <div>
          <Card className="print-hide" style={{ marginBottom: 'var(--space-6)' }}>
            <CardBody>
              <div className="field-row">
                <SelectField
                  label="Morador" icon={User}
                  value={residentId}
                  onChange={(e) => setResidentId(e.target.value)}
                >
                  {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </SelectField>

                <Field
                  label="Mês de referência"
                  hint="O ponto marca os meses que já possuem plantões registrados."
                >
                  <MonthPicker value={monthKey} onChange={setMonthKey} withData={months} />
                </Field>
              </div>
            </CardBody>
          </Card>

          <div className="print-hide" style={{ marginBottom: 'var(--space-6)' }}>
            <Segmented
              ariaLabel="Modo de visualização do mês"
              value={monthView}
              onChange={setMonthView}
              options={[
                { value: 'ficha', label: 'Ficha mensal', icon: ClipboardList },
                { value: 'leitura', label: 'Leitura', icon: BookOpen },
                { value: 'resumo', label: 'Resumo', icon: LayoutDashboard },
              ]}
            />
          </div>

          {/* Cabeçalho que só aparece no papel (a ficha traz o seu próprio) */}
          <div className={monthView === 'ficha' ? 'u-sr-only' : 'print-doc-header'}>
            <img src="/logo.png" alt="" className="print-doc-header__logo" />
            <div className="print-doc-header__title">Relatório Mensal de Evolução</div>
            <div className="print-doc-header__subtitle">
              {resident?.name} · {formatMonthLabel(monthKey)}
              <br />
              Aurean Residência Terapêutica — Porto Feliz/SP
            </div>
          </div>

          {!residents.length ? (
            <Card>
              <EmptyState
                icon={User}
                title="Nenhum morador cadastrado"
                description="Cadastre os moradores para gerar relatórios mensais."
              />
            </Card>
          ) : !summary || (summary.totalPlantoes === 0 && monthView !== 'ficha') ? (
            /* Leitura e Resumo dependem de plantões; a Ficha não —
               períodos antigos podem ser preenchidos à mão. */
            <Card>
              <EmptyState
                icon={FileText}
                title="Sem registros neste mês"
                description={`Não há passagens de plantão com anotações sobre ${resident?.name} em ${formatMonthLabel(monthKey)}. Para emitir a ficha deste período mesmo assim, use o modo Ficha mensal.`}
              />
            </Card>
          ) : (
            <div className="u-stack u-gap-6">
              {monthView === 'ficha' && summary.totalPlantoes === 0 && (
                <div className="print-hide" style={{ maxWidth: 820, margin: '0 auto var(--space-4)' }}>
                  <Alert tone="info" title="Período sem plantões registrados">
                    Não há passagens de plantão de {resident?.name} em{' '}
                    {formatMonthLabel(monthKey)}. A ficha pode ser preenchida e emitida
                    normalmente, mas as seções não terão rascunho automático.
                  </Alert>
                </div>
              )}

              {monthView === 'ficha' && (
                <MonthlySheet
                  resident={resident}
                  monthKey={monthKey}
                  onMonthChange={setMonthKey}
                  months={months}
                  summary={summary}
                  events={events}
                  incidents={incidents}
                  currentUser={currentUser}
                />
              )}

              {monthView === 'resumo' && (
                <>
              {/* ---------- Indicadores ---------- */}
              <StatGrid>
                <Stat
                  label="Plantões registrados" value={summary.totalPlantoes}
                  hint={`em ${summary.diasComRegistro} dias distintos`} icon={CalendarDays}
                />
                <Stat
                  label="Observações lançadas" value={summary.observacoes.length}
                  hint="anotações específicas das cuidadoras" icon={MessageSquareText}
                />
                <Stat
                  label="Ocorrências de recusa" value={summary.alertas.length}
                  tone={summary.alertas.length > 0 ? 'warning' : 'success'}
                  hint="higiene, alimentação ou medicação" icon={AlertTriangle}
                />
                <Stat
                  label="Dias sem registro" value={summary.diasSemRegistro.length}
                  tone={summary.diasSemRegistro.length > 0 ? 'danger' : 'success'}
                  hint={summary.diasSemRegistro.length > 0 ? 'lacuna de prontuário' : 'cobertura completa'}
                />
                <Stat
                  label="Relatos gerais a apurar" value={summary.relatosAApurar.length}
                  tone={summary.relatosAApurar.length > 0 ? 'warning' : 'default'}
                  hint="texto livre com termo de alerta" icon={Eye}
                />
                <Stat
                  label="Intercorrências" value={incidentesDoMorador.length}
                  tone={incidentesDoMorador.length > 0 ? 'danger' : 'success'}
                  hint="registradas com este morador envolvido" icon={Siren}
                />
              </StatGrid>

              {summary.diasSemRegistro.length > 0 && (
                <Alert tone="warning" title="Dias sem passagem de plantão registrada">
                  Dias {summary.diasSemRegistro.join(', ')} de {formatMonthLabel(monthKey)}.
                  Lacunas no prontuário são o primeiro item verificado em fiscalização.
                </Alert>
              )}

              {/* ---------- Intercorrências ---------- */}
              {incidentesDoMorador.length > 0 && (
                <Card accent="danger" className="print-avoid-break">
                  <CardHeader
                    icon={Siren}
                    title={`Intercorrências (${incidentesDoMorador.length})`}
                    subtitle="Episódios registrados com este morador entre os envolvidos"
                  />
                  <CardBody>
                    <Timeline>
                      {incidentesDoMorador.map((inc, idx) => (
                        <TimelineItem
                          key={inc.id}
                          tone="danger"
                          isLast={idx === incidentesDoMorador.length - 1}
                          date={formatDayMonth(inc.occurred_at)}
                          meta={<span>{inc.reporter_name}</span>}
                        >
                          <div className="u-row u-wrap u-gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                            <Badge tone={severityTone(inc.severity)} icon={Siren}>{inc.type}</Badge>
                            <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                            {(Array.isArray(inc.resident_names) ? inc.resident_names : []).map((n) => (
                              <Badge key={n} tone="neutral">{n}</Badge>
                            ))}
                          </div>
                          <p>{inc.description}</p>
                          {inc.conduct && (
                            <p className="u-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                              <strong>Conduta:</strong> {inc.conduct}
                            </p>
                          )}
                          {inc.notified && (
                            <p className="u-subtle" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                              Comunicado a: {inc.notified}
                            </p>
                          )}
                        </TimelineItem>
                      ))}
                    </Timeline>
                  </CardBody>
                </Card>
              )}

              {/* ---------- Comportamento observado ---------- */}
              {summary.behavior.alteracoes.length > 0 && (
                <Card className="print-avoid-break">
                  <CardHeader
                    title="Alterações de comportamento observadas"
                    subtitle="Marcadas pelas cuidadoras na passagem de plantão"
                  />
                  <CardBody>
                    <div className="u-stack u-gap-4">
                      {summary.behavior.alteracoes.map((alt) => (
                        <Meter
                          key={alt.label}
                          label={alt.label}
                          value={alt.count}
                          total={summary.totalPlantoes}
                          tone={behaviorTone(alt.label) === 'danger' ? 'danger' : 'warning'}
                          hint={`Dias: ${alt.dias.map((d) => String(d.day).padStart(2, '0')).join(', ')}`}
                        />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* ---------- Composição do mês ---------- */}
              <Card>
                <CardHeader
                  title="Como o mês transcorreu"
                  subtitle="Distribuição dos registros das cuidadoras ao longo do período"
                />
                <CardBody>
                  <div className="u-stack u-gap-6">
                    <StackedMeter
                      label="Higiene pessoal"
                      total={summary.totalPlantoes}
                      segments={summary.hygiene.segments}
                    />
                    <StackedMeter
                      label="Alimentação e hidratação"
                      total={summary.totalPlantoes}
                      segments={summary.food.segments}
                    />
                    <StackedMeter
                      label="Medicação"
                      total={summary.totalPlantoes}
                      segments={summary.meds.segments}
                    />
                  </div>
                </CardBody>
              </Card>

              {/* ---------- Ocorrências que exigem atenção ---------- */}
              {summary.alertas.length > 0 && (
                <Card accent="warning" className="print-avoid-break">
                  <CardHeader
                    icon={AlertTriangle}
                    title={`Ocorrências de recusa (${summary.alertas.length})`}
                    subtitle="Dias em que houve recusa de banho, alimentação ou medicação"
                  />
                  <CardBody>
                    <Timeline>
                      {summary.alertas.map((entry, idx) => {
                        const flags = [];
                        if (classifyHygiene(entry.hygiene) === 'recusou') {
                          flags.push({ icon: Droplets, label: HYGIENE_LABELS.recusou });
                        }
                        if (classifyFood(entry.food) === 'recusou') {
                          flags.push({ icon: Utensils, label: FOOD_LABELS.recusou });
                        }
                        if (classifyMeds(entry.meds) === 'recusou') {
                          flags.push({ icon: Pill, label: MEDS_LABELS.recusou });
                        }
                        return (
                          <TimelineItem
                            key={`${entry.reportId}-${idx}`}
                            tone="warning"
                            isLast={idx === summary.alertas.length - 1}
                            date={formatDayMonth(entry.date)}
                            meta={
                              <>
                                <span>{formatWeekday(entry.date, true)}</span>
                                <span>·</span>
                                <span>{entry.author}</span>
                              </>
                            }
                          >
                            <div className="u-row u-wrap u-gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                              {flags.map((f) => (
                                <Badge key={f.label} tone="warning" icon={f.icon}>{f.label}</Badge>
                              ))}
                            </div>
                            {entry.notes && <p>{entry.notes}</p>}
                          </TimelineItem>
                        );
                      })}
                    </Timeline>
                  </CardBody>
                </Card>
              )}

              {/* ---------- Todas as observações do mês ---------- */}
              <Card className="print-avoid-break">
                <CardHeader
                  icon={MessageSquareText}
                  title={`Observações das cuidadoras (${summary.observacoes.length})`}
                  subtitle="Tudo o que foi anotado sobre este morador no período"
                />
                <CardBody>
                  {summary.observacoes.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle2}
                      title="Nenhuma observação específica"
                      description="Não houve anotações individuais sobre este morador no período."
                    />
                  ) : (
                    <Timeline>
                      {summary.observacoes.map((obs, idx) => (
                        <TimelineItem
                          key={`${obs.day}-${idx}`}
                          isLast={idx === summary.observacoes.length - 1}
                          date={formatDayMonth(obs.date)}
                          meta={
                            <>
                              <span>{formatWeekday(obs.date, true)}</span>
                              <span>·</span>
                              <span>{obs.author}</span>
                            </>
                          }
                        >
                          {obs.text}
                        </TimelineItem>
                      ))}
                    </Timeline>
                  )}
                </CardBody>
              </Card>

                </>
              )}

              {/* ---------- Leitura corrida do mês ---------- */}
              {monthView === 'leitura' && (
                <>
                  <Card className="print-hide">
                    <CardBody tight>
                      <div className="u-between u-gap-4 u-wrap">
                        <Segmented
                          ariaLabel="Filtrar dias exibidos"
                          value={onlyWritten ? 'escritos' : 'todos'}
                          onChange={(v) => setOnlyWritten(v === 'escritos')}
                          options={[
                            { value: 'todos', label: `Todos os dias (${days.length})` },
                            { value: 'escritos', label: `Só com anotação sobre ele(a) (${daysWithWriting})` },
                          ]}
                        />

                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={showGeneral}
                            onChange={(e) => setShowGeneral(e.target.checked)}
                          />
                          <span className="checkbox__box" aria-hidden="true">
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span style={{ fontSize: 'var(--text-md)' }}>
                            Incluir relato geral da casa
                          </span>
                        </label>
                      </div>

                      <p
                        className="field__hint"
                        style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}
                      >
                        O selo verde considera apenas os três campos que a cuidadora
                        preencheu <strong>para este morador</strong> (higiene, alimentação
                        e medicação). O relato geral é texto livre sobre a casa: ele é
                        varrido por palavras-chave só para chamar atenção — a varredura
                        erra para os dois lados e não substitui a leitura.
                      </p>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader
                      icon={BookOpen}
                      title={`Leitura do mês — ${resident?.name}`}
                      subtitle={`${daysToRead.length} dia(s) em ${formatMonthLabel(monthKey)}, em ordem cronológica`}
                    />
                    <CardBody>
                      {daysToRead.length === 0 ? (
                        <EmptyState
                          icon={BookOpen}
                          title="Nenhum dia com anotação escrita"
                          description="As cuidadoras não deixaram observações em texto neste período. Veja o modo Resumo para os indicadores."
                        />
                      ) : (
                        <div className="reading">
                          {daysToRead.map((group) => (
                            <div className="reading__day" key={group.day}>
                              <div className="reading__daymark">
                                <div className="reading__daynum">
                                  {String(group.day).padStart(2, '0')}
                                </div>
                                <div className="reading__dayweek">
                                  {formatWeekday(group.date, true)}
                                </div>
                                <div className="reading__daycount">
                                  {group.items.length === 1 ? '1 plantão' : `${group.items.length} plantões`}
                                </div>
                              </div>

                              <div className="reading__entries">
                                {group.items.map((entry, idx) => {
                                  const h = classifyHygiene(entry.hygiene);
                                  const f = classifyFood(entry.food);
                                  const m = classifyMeds(entry.meds);

                                  const desvios = [];
                                  if (h !== 'realizada') desvios.push({ key: 'h', icon: Droplets, tone: h === 'recusou' ? 'danger' : 'warning', text: entry.hygiene });
                                  if (f !== 'bem') desvios.push({ key: 'f', icon: Utensils, tone: f === 'recusou' ? 'danger' : 'warning', text: entry.food });
                                  if (m !== 'tomou' && m !== 'sem_medicacao') desvios.push({ key: 'm', icon: Pill, tone: 'danger', text: entry.meds });

                                  // O selo acima fala SÓ dos três campos deste morador.
                                  // O relato geral é texto livre sobre a casa e é varrido
                                  // à parte — verde só quando ambos estão limpos.
                                  const geral = scanGeneralNotes(entry.generalNotes);
                                  const geralLimpo = geral.status === 'rotina' || geral.status === 'vazio';

                                  const attention =
                                    desvios.some((d) => d.tone === 'danger') || geral.status === 'atencao';

                                  return (
                                    <article
                                      className="reading__entry"
                                      key={`${entry.reportId}-${idx}`}
                                      data-written={entry.notes ? 'true' : 'false'}
                                      data-attention={attention ? 'true' : 'false'}
                                    >
                                      <div className="reading__byline">
                                        <Avatar name={entry.author} size="sm" />
                                        <span className="reading__author">{entry.author}</span>
                                        <Badge tone="neutral">{shiftLabel(entry.date)}</Badge>
                                        <span className="reading__time">
                                          assinado às {formatTime(entry.date)}
                                        </span>
                                      </div>

                                      <div className="reading__chips">
                                        {desvios.length === 0 ? (
                                          <Badge
                                            tone={geralLimpo ? 'success' : 'neutral'}
                                            icon={geralLimpo ? CheckCircle2 : undefined}
                                          >
                                            {firstName(resident?.name)}: sem alteração na rotina
                                          </Badge>
                                        ) : (
                                          desvios.map((d) => (
                                            <Badge key={d.key} tone={d.tone} icon={d.icon}>
                                              {d.text}
                                            </Badge>
                                          ))
                                        )}

                                        {geral.status === 'atencao' && (
                                          <Badge tone="warning" icon={AlertTriangle}>
                                            Relato geral: possível {geral.categorias.join(' / ').toLowerCase()}
                                          </Badge>
                                        )}
                                        {geral.status === 'conteudo' && (
                                          <Badge tone="info" icon={Eye}>
                                            Relato geral com conteúdo
                                          </Badge>
                                        )}
                                      </div>

                                      {entry.notes ? (
                                        <p className="reading__note">{entry.notes}</p>
                                      ) : (
                                        <p className="reading__note reading__note--empty">
                                          Sem observação específica sobre {resident?.name?.split(' ')[0]} neste plantão.
                                        </p>
                                      )}

                                      {showGeneral && entry.generalNotes && (
                                        <div
                                          className={`reading__general ${geral.status === 'atencao' ? 'reading__general--flagged' : ''}`}
                                        >
                                          <div className="reading__general-label">
                                            Relato geral do plantão
                                          </div>
                                          <div className="reading__general-text">
                                            {entry.generalNotes}
                                          </div>
                                        </div>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </>
              )}

              {/* ---------- Parecer da supervisão (análise interna) ---------- */}
              {monthView !== 'ficha' && (
              <Card className="print-avoid-break">
                <CardHeader
                  title="Parecer da supervisão"
                  subtitle={
                    storedNarrative
                      ? `Última atualização por ${storedNarrative.author_name} em ${formatDateTime(storedNarrative.updated_at)}`
                      : 'Ainda não redigido para este mês'
                  }
                  actions={
                    <div className="print-hide u-row u-gap-2">
                      <Button
                        variant="secondary" size="sm" icon={Sparkles}
                        onClick={() => setNarrative(suggestion)}
                      >
                        Gerar rascunho
                      </Button>
                      {narrativeTable && (
                        <Button
                          variant="primary" size="sm" icon={Save}
                          onClick={saveNarrative} loading={savingNarrative}
                        >
                          Salvar
                        </Button>
                      )}
                    </div>
                  }
                />
                <CardBody>
                  {!narrativeTable && (
                    <div style={{ marginBottom: 'var(--space-4)' }} className="print-hide">
                      <Alert tone="warning" title="Parecer ainda não pode ser arquivado">
                        A tabela <code>MonthlyReport</code> não existe no banco. O texto abaixo
                        pode ser gerado e impresso, mas se perde ao sair da tela. Rode a
                        migração <code>supabase/migrations/001_monthly_report.sql</code> para
                        habilitar o arquivamento.
                      </Alert>
                    </div>
                  )}

                  <div className="print-hide">
                    <TextareaField
                      label="Análise do período"
                      hint='Use "Gerar rascunho" para partir dos números já apurados e depois ajuste com sua leitura clínica.'
                      rows={9}
                      placeholder="Descreva a evolução do morador no período…"
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                    />
                  </div>

                  {/* Versão impressa do parecer */}
                  <div className="print-only" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {narrative || 'Parecer não redigido.'}
                  </div>
                </CardBody>
              </Card>
              )}

              {monthView !== 'ficha' && (
                <>
                  <div className="print-signature">
                    <div className="print-signature__line" />
                    <div className="print-signature__caption">
                      {currentUser?.name || 'Supervisão'} — Supervisão técnica
                    </div>
                  </div>

                  <div className="print-doc-footer">
                    Emitido por {currentUser?.name || 'Administração'} em {formatDateTime(new Date())}
                    {' · '}Aurean Residência Terapêutica
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= VISÃO DIÁRIA ================= */}
      {tab === 'diario' && (
        <div>
          <Card className="print-hide" style={{ marginBottom: 'var(--space-6)' }}>
            <CardBody>
              <div className="u-between u-gap-4 u-wrap">
                <div style={{ minWidth: 220, flex: 1 }}>
                  <label className="field__label" htmlFor="day-filter">Data do plantão</label>
                  <input
                    id="day-filter"
                    type="date"
                    className="input"
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                  />
                </div>
                <Button variant="ghost" icon={RefreshCw} onClick={load}>Atualizar</Button>
              </div>
            </CardBody>
          </Card>

          <div className="print-doc-header">
            <img src="/logo.png" alt="" className="print-doc-header__logo" />
            <div className="print-doc-header__title">Relatório Diário de Passagem de Plantão</div>
            <div className="print-doc-header__subtitle">
              {formatDate(dayFilter)} · Aurean Residência Terapêutica
            </div>
          </div>

          {reportsOfDay.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarDays}
                title="Nenhum plantão registrado nesta data"
                description={`Não há passagens de plantão arquivadas em ${formatDate(dayFilter)}.`}
              />
            </Card>
          ) : (
            <div className="u-stack u-gap-4">
              {reportsOfDay.map((report) => (
                <Card key={report.id} className="print-avoid-break">
                  <CardHeader
                    actions={
                      <Button
                        variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                        className="print-hide"
                        onClick={() => deleteReport(report)}
                        aria-label="Apagar registro"
                      />
                    }
                  >
                    <div className="u-row u-gap-3">
                      <Avatar name={report.caregiver_name} />
                      <div>
                        <div className="card__title">{report.caregiver_name}</div>
                        <div className="card__subtitle">{formatDateTime(report.date)}</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardBody>
                    {report.general_notes && (
                      <div style={{ marginBottom: 'var(--space-5)' }}>
                        <p className="divider-label" style={{ marginBottom: 'var(--space-2)' }}>
                          Relato geral do plantão
                        </p>
                        <Alert tone="warning">{report.general_notes}</Alert>
                      </div>
                    )}

                    <p className="divider-label" style={{ marginBottom: 'var(--space-3)' }}>
                      Por morador
                    </p>

                    <div className="u-stack u-gap-3">
                      {residents.map((res) => {
                        const data = report.reports?.[res.id];
                        if (!data) return null;
                        return (
                          <div
                            key={res.id}
                            style={{
                              padding: 'var(--space-4)',
                              background: 'var(--surface-sunken)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <strong style={{ color: 'var(--text-strong)' }}>{res.name}</strong>
                            <div className="u-row u-wrap u-gap-2" style={{ marginTop: 'var(--space-2)' }}>
                              <Badge
                                tone={classifyHygiene(data.hygiene) === 'recusou' ? 'danger' : 'neutral'}
                                icon={Droplets}
                              >
                                {data.hygiene}
                              </Badge>
                              <Badge
                                tone={classifyFood(data.food) === 'recusou' ? 'danger' : 'neutral'}
                                icon={Utensils}
                              >
                                {data.food}
                              </Badge>
                              <Badge
                                tone={classifyMeds(data.meds) === 'recusou' ? 'danger' : 'neutral'}
                                icon={Pill}
                              >
                                {data.meds}
                              </Badge>
                            </div>
                            {data.notes && (
                              <p
                                style={{
                                  marginTop: 'var(--space-3)',
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

                    <div
                      className="u-row u-gap-2"
                      style={{
                        marginTop: 'var(--space-5)',
                        paddingTop: 'var(--space-4)',
                        borderTop: '1px dashed var(--border)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--success)" aria-hidden="true" />
                      Assinado eletronicamente por <strong>{report.caregiver_name}</strong>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          <div className="print-doc-footer">
            Emitido por {currentUser?.name || 'Administração'} em {formatDateTime(new Date())}
          </div>
        </div>
      )}
    </div>
  );
}
