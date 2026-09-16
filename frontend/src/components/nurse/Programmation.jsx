import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { EVENT_TYPES, SOCIAL_EVENT_TYPES } from '../../lib/clinical';
import { formatDate, formatWeekday, toISODate, toDate } from '../../lib/format';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHeader,
  SelectField, SkeletonList, TextareaField, TextField, useConfirm, useToast,
} from '../ui';

const EMPTY = { title: '', type: EVENT_TYPES[0], residentId: '', date: '', time: '', location: '', notes: '' };

export default function Programmation({ role }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [events, setEvents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

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

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      toast.warning('Informe título, data e hora.');
      return;
    }

    setSaving(true);
    const resident = residents.find((r) => r.id === form.residentId);

    const { error } = await supabase.from('Event').insert([{
      id: uid(),
      title: form.title.trim(),
      type: form.type,
      resident_id: form.residentId || null,
      resident_name: resident?.name || 'Geral (todos)',
      date: form.date,
      time: form.time,
      location: form.location.trim(),
      notes: form.notes.trim(),
    }]);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao agendar: ${error.message}`);
      return;
    }
    setForm(EMPTY);
    setFormOpen(false);
    toast.success('Compromisso agendado.');
    load();
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
                {isToday && <Badge tone="warning">Hoje</Badge>}
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

              {event.notes && (
                <p
                  style={{
                    marginTop: 'var(--space-3)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {event.notes}
                </p>
              )}
            </div>

            {canEdit && (
              <Button
                variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                onClick={() => remove(event)}
                aria-label={`Excluir ${event.title}`}
              />
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
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
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
                <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Novo compromisso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={submit} loading={saving}>Agendar</Button>
          </>
        }
      >
        <form onSubmit={submit} className="u-stack u-gap-4">
          <TextField
            label="Título" required autoFocus
            placeholder="Ex.: Consulta com Dr. João — psiquiatria"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />

          <SelectField
            label="Tipo de compromisso" required
            hint="Define em qual seção da ficha mensal o compromisso aparece."
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectField>

          <SelectField
            label="Morador"
            value={form.residentId}
            onChange={(e) => setForm((f) => ({ ...f, residentId: e.target.value }))}
          >
            <option value="">Geral (toda a casa)</option>
            {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectField>

          <div className="field-row">
            <TextField
              label="Data" type="date" required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <TextField
              label="Hora" type="time" required
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>

          <TextField
            label="Local"
            placeholder="Ex.: UBS Central — sala 3"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />

          <TextareaField
            label="Observações"
            placeholder="Ex.: comparecer em jejum, levar cartão SUS…"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
