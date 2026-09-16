import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Cake, CalendarDays, ClipboardEdit, Clock, MapPin, RefreshCw,
  Siren, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  calcAge, firstName, formatDate, formatDateTime, formatMonthLabel,
  formatWeekday, MESES, toDate, toISODate, toMonthKey,
} from '../../lib/format';
import { severityTone, SOCIAL_EVENT_TYPES } from '../../lib/clinical';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState,
  PageHeader, SkeletonList, Stat, StatGrid,
} from '../ui';

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Mês anterior ao atual, em 'YYYY-MM'. */
function mesAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toMonthKey(d);
}

export default function Overview({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    residents: [], events: [], incidents: [], shifts: [],
    foods: [], meds: [], fichas: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const prev = mesAnterior();

    const [residents, events, incidents, shifts, foods, meds, fichas] = await Promise.all([
      supabase.from('Resident').select('*').order('name'),
      supabase.from('Event').select('*').order('date', { ascending: true }),
      supabase.from('Incident').select('*').order('occurred_at', { ascending: false }).limit(20),
      supabase.from('ShiftReport').select('*').order('date', { ascending: false }).limit(20),
      supabase.from('FoodItem').select('*'),
      supabase.from('Medication').select('*'),
      supabase.from('MonthlyReport').select('resident_id, month').eq('month', prev),
    ]);

    setData({
      residents: residents.data || [],
      events: events.data || [],
      incidents: incidents.data || [],
      shifts: shifts.data || [],
      foods: foods.data || [],
      meds: meds.data || [],
      fichas: fichas.data || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hoje = toISODate(new Date());
  const prevKey = mesAnterior();

  /* ------------------------- Derivações ------------------------- */

  const agenda = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() + 14);
    const limiteISO = toISODate(limite);

    return data.events
      .filter((ev) => String(ev.date) >= hoje && String(ev.date) <= limiteISO)
      .sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
  }, [data.events, hoje]);

  const eventosHoje = useMemo(
    () => agenda.filter((ev) => String(ev.date) === hoje),
    [agenda, hoje]
  );

  const incidentes7d = useMemo(() => {
    const corte = new Date();
    corte.setDate(corte.getDate() - 7);
    return data.incidents.filter((inc) => {
      const d = toDate(inc.occurred_at);
      return d && d >= corte;
    });
  }, [data.incidents]);

  const paraComprar = useMemo(() => {
    const food = data.foods.filter((f) => (f.quantity ?? 0) <= (f.minQuantity ?? 0));
    const med = data.meds.filter((m) => (m.stock ?? 0) <= (m.minStock ?? 0));
    return [...food, ...med];
  }, [data.foods, data.meds]);

  const plantoesHoje = useMemo(
    () => data.shifts.filter((s) => String(s.date).startsWith(hoje)).length,
    [data.shifts, hoje]
  );

  const ultimoPlantao = data.shifts[0];

  const fichasPendentes = useMemo(() => {
    const feitas = new Set(data.fichas.map((f) => f.resident_id));
    return data.residents.filter((r) => !feitas.has(r.id));
  }, [data.fichas, data.residents]);

  const aniversariantes = useMemo(() => {
    const mes = new Date().getMonth();
    return data.residents
      .filter((r) => {
        const d = toDate(r.dateOfBirth);
        return d && d.getMonth() === mes;
      })
      .sort((a, b) => toDate(a.dateOfBirth).getDate() - toDate(b.dateOfBirth).getDate());
  }, [data.residents]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Painel" description="Carregando o panorama da casa…" />
        <SkeletonList count={4} />
      </div>
    );
  }

  const temAlerta =
    incidentes7d.length > 0 || paraComprar.length > 0 || plantoesHoje === 0 || fichasPendentes.length > 0;

  return (
    <div>
      <PageHeader
        title={`${saudacao()}, ${firstName(currentUser?.name) || 'equipe'}`}
        description={`${formatWeekday(new Date())}, ${formatDate(new Date())} — panorama da residência.`}
        actions={
          <Button variant="ghost" icon={RefreshCw} onClick={load}>
            Atualizar
          </Button>
        }
      />

      {/* ---------------- Indicadores ---------------- */}
      <StatGrid style={{ marginBottom: 'var(--space-6)' }}>
        <Stat
          label="Moradores" value={data.residents.length}
          hint="cadastrados na casa" icon={Users}
        />
        <Stat
          label="Compromissos hoje" value={eventosHoje.length}
          tone={eventosHoje.length > 0 ? 'warning' : 'default'}
          hint={eventosHoje.length > 0 ? 'exigem preparo' : 'nenhum agendado'} icon={CalendarDays}
        />
        <Stat
          label="Plantões hoje" value={plantoesHoje}
          tone={plantoesHoje === 0 ? 'danger' : 'success'}
          hint={plantoesHoje === 0 ? 'nada registrado ainda' : 'já registrados'} icon={ClipboardEdit}
        />
        <Stat
          label="Intercorrências (7 dias)" value={incidentes7d.length}
          tone={incidentes7d.length > 0 ? 'danger' : 'success'}
          hint="episódios registrados" icon={Siren}
        />
      </StatGrid>

      {/* ---------------- O que precisa de ação ---------------- */}
      {temAlerta && (
        <section className="section">
          <div className="section__header">
            <h2 className="section__title">
              <AlertTriangle size={18} aria-hidden="true" />
              Precisa da sua atenção
            </h2>
          </div>

          <div className="u-stack u-gap-3">
            {plantoesHoje === 0 && (
              <Alert tone="warning" title="Nenhum plantão registrado hoje">
                Se já houve troca de turno, o relatório ainda não foi assinado.
                Lacunas de prontuário são o primeiro item que a fiscalização procura.
              </Alert>
            )}

            {incidentes7d.length > 0 && (
              <Alert
                tone="danger"
                title={`${incidentes7d.length} intercorrência(s) nos últimos 7 dias`}
              >
                {incidentes7d.slice(0, 3).map((inc) => (
                  <div key={inc.id} style={{ marginTop: 'var(--space-2)' }}>
                    <strong>{formatDate(inc.occurred_at)} · {inc.type}</strong>
                    {' — '}
                    {(Array.isArray(inc.resident_names) ? inc.resident_names : []).join(', ')}
                  </div>
                ))}
              </Alert>
            )}

            {fichasPendentes.length > 0 && (
              <Alert
                tone="warning"
                title={`${fichasPendentes.length} ficha(s) mensal(is) de ${formatMonthLabel(prevKey)} ainda não emitida(s)`}
              >
                {fichasPendentes.map((r) => r.name).join(' · ')}
              </Alert>
            )}

            {paraComprar.length > 0 && (
              <Alert
                tone="warning"
                title={`${paraComprar.length} item(ns) no ou abaixo do estoque mínimo`}
              >
                {paraComprar.slice(0, 6).map((i) => i.name).join(' · ')}
                {paraComprar.length > 6 && ` e mais ${paraComprar.length - 6}`}
              </Alert>
            )}
          </div>
        </section>
      )}

      {!temAlerta && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Alert tone="success" title="Nada pendente no momento">
            Plantão do dia registrado, estoque acima do mínimo, sem intercorrências
            recentes e fichas mensais em dia.
          </Alert>
        </div>
      )}

      <div className="grid-split">
        {/* ---------------- Coluna lateral ---------------- */}
        <div className="u-stack u-gap-4">
          <Card>
            <CardHeader icon={ClipboardEdit} title="Último plantão" />
            <CardBody tight>
              {!ultimoPlantao ? (
                <EmptyState icon={ClipboardEdit} title="Nenhum plantão registrado" />
              ) : (
                <>
                  <div className="u-row u-gap-3" style={{ marginBottom: 'var(--space-3)' }}>
                    <Avatar name={ultimoPlantao.caregiver_name} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {ultimoPlantao.caregiver_name}
                      </div>
                      <div className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatDateTime(ultimoPlantao.date)}
                      </div>
                    </div>
                  </div>
                  {ultimoPlantao.general_notes && (
                    <p
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-muted)',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 'var(--space-3)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {ultimoPlantao.general_notes}
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {aniversariantes.length > 0 && (
            <Card accent="primary">
              <CardHeader
                icon={Cake}
                title={`Aniversariantes de ${MESES[new Date().getMonth()].toLowerCase()}`}
              />
              <CardBody tight>
                <div className="u-stack u-gap-3">
                  {aniversariantes.map((r) => {
                    const d = toDate(r.dateOfBirth);
                    const fazHoje = d.getDate() === new Date().getDate();
                    return (
                      <div key={r.id} className="u-row u-gap-3">
                        <Avatar name={r.name} size="sm" />
                        <div className="u-grow" style={{ minWidth: 0 }}>
                          <div
                            className="u-truncate"
                            style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-strong)' }}
                          >
                            {r.name}
                          </div>
                          <div className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                            dia {String(d.getDate()).padStart(2, '0')} · faz {(calcAge(r.dateOfBirth) ?? 0) + (fazHoje ? 0 : 1)} anos
                          </div>
                        </div>
                        {fazHoje && <Badge tone="primary">Hoje</Badge>}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* ---------------- Agenda ---------------- */}
        <Card>
          <CardHeader
            icon={CalendarDays}
            title="Próximos compromissos"
            subtitle="Consultas, exames, visitas e atividades dos próximos 14 dias"
          />
          <CardBody tight>
            {agenda.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum compromisso agendado"
                description="Consultas e exames cadastrados na Agenda aparecem aqui e alimentam a ficha mensal dos moradores."
              />
            ) : (
              <div className="u-stack u-gap-3">
                {agenda.slice(0, 10).map((ev) => {
                  const isHoje = String(ev.date) === hoje;
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: isHoje ? 'var(--warning-subtle)' : 'var(--surface)',
                      }}
                    >
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 44 }}>
                        <div
                          style={{
                            fontSize: 'var(--text-lg)',
                            fontWeight: 'var(--weight-bold)',
                            color: isHoje ? 'var(--warning-text)' : 'var(--text-strong)',
                            lineHeight: 1,
                          }}
                        >
                          {String(toDate(ev.date).getDate()).padStart(2, '0')}
                        </div>
                        <div
                          className="u-subtle"
                          style={{ fontSize: 'var(--text-2xs)', textTransform: 'uppercase' }}
                        >
                          {formatWeekday(ev.date, true)}
                        </div>
                      </div>

                      <div className="u-grow" style={{ minWidth: 0 }}>
                        <div className="u-row u-wrap u-gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                          <strong style={{ color: 'var(--text-strong)' }}>{ev.title}</strong>
                          {isHoje && <Badge tone="warning">Hoje</Badge>}
                        </div>
                        <div
                          className="u-row u-wrap u-gap-3 u-muted"
                          style={{ fontSize: 'var(--text-sm)' }}
                        >
                          <span className="u-row u-gap-1">
                            <Clock size={13} aria-hidden="true" /> {ev.time}
                          </span>
                          <span>{ev.resident_name}</span>
                          {ev.location && (
                            <span className="u-row u-gap-1">
                              <MapPin size={13} aria-hidden="true" /> {ev.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {ev.type && (
                        <Badge tone={SOCIAL_EVENT_TYPES.includes(ev.type) ? 'success' : 'info'}>
                          {ev.type}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---------------- Intercorrências recentes ---------------- */}
      {data.incidents.length > 0 && (
        <section className="section" style={{ marginTop: 'var(--space-8)' }}>
          <div className="section__header">
            <h2 className="section__title">
              <Siren size={18} aria-hidden="true" />
              Intercorrências recentes
            </h2>
            <p className="section__description">
              Últimos episódios registrados na casa, de todos os moradores.
            </p>
          </div>

          <div className="list">
            {data.incidents.slice(0, 5).map((inc) => (
              <Card key={inc.id} accent={severityTone(inc.severity) === 'danger' ? 'danger' : 'warning'}>
                <CardBody tight>
                  <div className="u-between u-gap-3 u-wrap" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="u-row u-wrap u-gap-2">
                      <Badge tone={severityTone(inc.severity)} icon={Siren}>{inc.type}</Badge>
                      <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                      {(Array.isArray(inc.resident_names) ? inc.resident_names : []).map((n) => (
                        <Badge key={n} tone="neutral">{n}</Badge>
                      ))}
                    </div>
                    <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                      {formatDateTime(inc.occurred_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--text-md)' }}>{inc.description}</p>
                  {inc.conduct && (
                    <p
                      className="u-muted"
                      style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}
                    >
                      <strong>Conduta:</strong> {inc.conduct}
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
