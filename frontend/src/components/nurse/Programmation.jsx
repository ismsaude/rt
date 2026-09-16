import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, CheckCircle2, Clock, MapPin, Pencil, Plus,
  Trash2, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SOCIAL_EVENT_TYPES } from '../../lib/clinical';
import { formatDate, formatWeekday, toISODate, toDate } from '../../lib/format';
import {
  Badge, Button, Card, CardBody, EmptyState, PageHeader, SkeletonList,
  useConfirm, useToast,
} from '../ui';
import EventFormModal from '../EventFormModal';


export default function Programmation({ role }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [events, setEvents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const canEdit = role === 'admin' || role === 'enfermeiro';

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: res }] = await Promise.all([
      supabase.from('Event').select('*').order('date', { ascending: true }),
      supabase.from('Resident').select('id, name').order('name'),
    ]);

    if (error) toast.error('Não foi possível carregar a agenda.');
    setEvents(data || []);
    setResidents(res || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const { upcoming, past } = useMemo(() => {
    const today = toISODate(new Date());
    const sorted = [...events].sort((a, b) =>
      `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)
    );
    return {
      upcoming: sorted.filter((e) => String(e.date) >= today),
      past: sorted.filter((e) => String(e.date) < today).reverse(),
    };
  }, [events]);

  const abrirNovo = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const abrirEdicao = (event) => {
    setEditing(event);
    setFormOpen(true);
  };

  const remove = async (event) => {
    const ok = await confirm({
      title: 'Excluir compromisso',
      message: `"${event.title}" de ${formatDate(event.date)} será removido da agenda.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('Event').delete().eq('id', event.id);
    if (error) {
      toast.error('Erro ao excluir o compromisso.');
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    toast.success('Compromisso excluído.');
  };

  const renderEvent = (event, isPast = false) => {
    const eventDate = toDate(event.date);
    const isToday = toISODate(eventDate) === toISODate(new Date());

    return (
      <Card key={event.id} accent={isPast ? undefined : isToday ? 'warning' : 'primary'}>
        <CardBody tight>
          <div className="u-between u-gap-3">
            <div style={{ minWidth: 0, flex: 1, opacity: isPast ? 0.65 : 1 }}>
              <div className="u-row u-wrap u-gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                <Badge tone={isToday ? 'warning' : 'primary'} icon={CalendarIcon}>
                  {formatDate(event.date)} · {formatWeekday(event.date, true)}
                </Badge>
                <Badge tone="neutral" icon={Clock}>{event.time}</Badge>
                {event.type && (
                  <Badge tone={SOCIAL_EVENT_TYPES.includes(event.type) ? 'success' : 'info'}>
                    {event.type}
                  </Badge>
                )}
                {isToday && !event.done && <Badge tone="warning">Hoje</Badge>}
                {event.done && <Badge tone="success" icon={CheckCircle2}>Realizado</Badge>}
              </div>

              <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>
                {event.title}
              </h3>

              <div
                className="u-row u-wrap u-gap-4 u-muted"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <span className="u-row u-gap-1">
                  <User size={13} aria-hidden="true" /> {event.resident_name}
                </span>
                {event.location && (
                  <span className="u-row u-gap-1">
                    <MapPin size={13} aria-hidden="true" /> {event.location}
                  </span>
                )}
              </div>

              {(event.notes || event.outcome) && (
                <div
                  style={{
                    marginTop: 'var(--space-3)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {event.notes && <p>{event.notes}</p>}
                  {event.outcome && (
                    <p style={{ marginTop: event.notes ? 'var(--space-2)' : 0 }}>
                      <strong>Desfecho:</strong> {event.outcome}
                    </p>
                  )}
                </div>
              )}
            </div>

            {canEdit && (
              <div className="u-row u-gap-1" style={{ flexShrink: 0 }}>
                <Button
                  variant="ghost" size="sm" iconOnly icon={Pencil}
                  onClick={() => abrirEdicao(event)}
                  aria-label={`Editar ${event.title}`}
                />
                <Button
                  variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                  onClick={() => remove(event)}
                  aria-label={`Excluir ${event.title}`}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Consultas, exames e compromissos dos moradores."
        actions={
          canEdit && (
            <Button variant="primary" icon={Plus} onClick={abrirNovo}>
              Novo compromisso
            </Button>
          )
        }
      />

      {loading ? (
        <SkeletonList count={3} />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarIcon}
            title="Nenhum compromisso agendado"
            description="Consultas, exames e saídas aparecem aqui para toda a equipe."
            action={
              canEdit && (
                <Button variant="primary" icon={Plus} onClick={abrirNovo}>
                  Agendar compromisso
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="u-stack u-gap-8">
          <section>
            <p className="divider-label" style={{ marginBottom: 'var(--space-3)' }}>
              Próximos ({upcoming.length})
            </p>
            {upcoming.length === 0 ? (
              <Card><EmptyState icon={CalendarIcon} title="Nenhum compromisso futuro" /></Card>
            ) : (
              <div className="list">{upcoming.map((e) => renderEvent(e))}</div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <p className="divider-label" style={{ marginBottom: 'var(--space-3)' }}>
                Já realizados ({past.length})
              </p>
              <div className="list">{past.slice(0, 10).map((e) => renderEvent(e, true))}</div>
            </section>
          )}
        </div>
      )}

      <EventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        event={editing}
        residents={residents}
      />
    </div>
  );
}
