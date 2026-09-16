import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, CheckCircle2, Circle, ListChecks, MapPin, Pencil, Plus,
  Trash2, User,
} from 'lucide-react';
import { formatDateTime, isSoon, relativeDayLabel, toDate, toISODate } from '../lib/format';
import { SOCIAL_EVENT_TYPES } from '../lib/clinical';
import { supabase } from '../lib/supabase';
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, PageHeader,
  SkeletonList, TextField, useConfirm, useToast,
} from './ui';
import EventFormModal from './EventFormModal';

/** Por horário previsto; sem horário vai para o fim da lista. */
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (!a.time && !b.time) return String(a.title).localeCompare(String(b.title));
    if (!a.time) return 1;
    if (!b.time) return -1;
    return String(a.time).localeCompare(String(b.time));
  });
}

export default function Dashboard({ role, currentUser }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [eventForm, setEventForm] = useState({ open: false, event: null });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: '', time: '' });

  const isManager = role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    // Ordena no cliente: "time" é opcional e tarefas sem horário
    // devem ficar no fim, o que o ORDER BY do banco não resolveria.
    const hoje = toISODate(new Date());
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);

    const [{ data, error }, { data: evs }, { data: res }] = await Promise.all([
      supabase.from('Task').select('*'),
      supabase
        .from('Event')
        .select('*')
        .gte('date', hoje)
        .lte('date', toISODate(limite)),
      supabase.from('Resident').select('id, name').order('name'),
    ]);

    if (error) {
      toast.error('Não foi possível carregar as tarefas.');
      setTasks([]);
    } else {
      setTasks(sortTasks(data || []));
    }

    setEvents(
      (evs || []).sort((a, b) =>
        `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)
      )
    );
    setResidents(res || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.time) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('Task')
      .insert([{ title: draft.title.trim(), time: draft.time, isDone: false }])
      .select();
    setSaving(false);

    if (error) {
      toast.error('Erro ao cadastrar a tarefa.');
      return;
    }
    setTasks((prev) => sortTasks([...prev, ...(data || [])]));
    setDraft({ title: '', time: '' });
    setFormOpen(false);
    toast.success('Tarefa cadastrada.');
  };

  const toggleTask = async (task) => {
    const next = !task.isDone;

    // Concluir registra quem e quando — desfazer limpa o rastro.
    const patch = next
      ? { isDone: true, doneAt: new Date().toISOString(), doneBy: currentUser?.name || 'Equipe' }
      : { isDone: false, doneAt: null, doneBy: null };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));

    const { error } = await supabase.from('Task').update(patch).eq('id', task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      toast.error('Não foi possível salvar. Verifique a conexão.');
    }
  };

  const removeEvent = async (event) => {
    const ok = await confirm({
      title: 'Excluir compromisso',
      message: `"${event.title}" de ${event.resident_name} será removido da agenda.`,
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

  const removeTask = async (task) => {
    const ok = await confirm({
      title: 'Excluir tarefa',
      message: `A tarefa "${task.title}" será removida da rotina.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('Task').delete().eq('id', task.id);
    if (error) {
      toast.error('Erro ao excluir a tarefa.');
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.success('Tarefa excluída.');
  };

  const done = tasks.filter((t) => t.isDone).length;

  return (
    <div>
      <PageHeader
        title="Tarefas e Compromissos"
        description={
          tasks.length > 0
            ? `${done} de ${tasks.length} tarefas concluídas.`
            : 'Rotina da casa e agenda dos moradores.'
        }
        actions={
          isManager && (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Nova tarefa
            </Button>
          )
        }
      />

      {/* Compromissos dos próximos 7 dias. Layout compacto: a tela é
          sempre um celular, e a lista não pode empurrar as tarefas
          para fora do campo de visão. */}
      {!loading && events.length > 0 && (
        <Card accent="warning" style={{ marginBottom: 'var(--space-5)' }}>
          <CardHeader
            icon={CalendarClock}
            title="Próximos compromissos"
            subtitle={
              events.length === 1
                ? '1 agendamento nos próximos 7 dias'
                : `${events.length} agendamentos nos próximos 7 dias`
            }
            actions={
              isManager && (
                <Button
                  variant="secondary" size="sm" icon={Plus}
                  onClick={() => setEventForm({ open: true, event: null })}
                >
                  Agendar
                </Button>
              )
            }
          />
          <CardBody tight>
            <div className="agenda">
              {events.map((ev) => {
                const d = toDate(ev.date);
                const soon = isSoon(ev.date);
                return (
                  <div
                    className="agenda__item"
                    key={ev.id}
                    data-actions={isManager ? 'true' : 'false'}
                  >
                    <div className={`agenda__when ${soon ? 'agenda__when--soon' : ''}`}>
                      <div className="agenda__day">
                        {String(d.getDate()).padStart(2, '0')}
                      </div>
                      <div className="agenda__weekday">{relativeDayLabel(ev.date)}</div>
                    </div>

                    <div className="agenda__body">
                      <div className="agenda__title">
                        <span className="agenda__time">{ev.time}</span>
                        <span>{ev.title}</span>
                      </div>
                      <div className="agenda__meta">
                        <span className="u-row u-gap-1">
                          <User size={12} aria-hidden="true" /> {ev.resident_name}
                        </span>
                        {ev.location && (
                          <span className="u-row u-gap-1">
                            <MapPin size={12} aria-hidden="true" /> {ev.location}
                          </span>
                        )}
                        {ev.type && (
                          <Badge tone={SOCIAL_EVENT_TYPES.includes(ev.type) ? 'success' : 'info'}>
                            {ev.type}
                          </Badge>
                        )}
                      </div>
                      {ev.notes && <div className="agenda__note">{ev.notes}</div>}
                    </div>

                    {isManager && (
                      <div className="u-row u-gap-1" style={{ flexShrink: 0 }}>
                        <Button
                          variant="ghost" size="sm" iconOnly icon={Pencil}
                          onClick={() => setEventForm({ open: true, event: ev })}
                          aria-label={`Editar ${ev.title}`}
                        />
                        <Button
                          variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                          onClick={() => removeEvent(ev)}
                          aria-label={`Excluir ${ev.title}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Nenhuma tarefa cadastrada"
            description={
              isManager
                ? 'Cadastre as tarefas recorrentes da casa para que a equipe acompanhe a rotina.'
                : 'A supervisão ainda não cadastrou tarefas para hoje.'
            }
            action={
              isManager && (
                <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                  Cadastrar tarefa
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="list">
          {tasks.map((task) => (
            <Card key={task.id} accent={task.isDone ? 'success' : 'primary'}>
              <CardBody tight>
                <div className="u-row u-gap-3">
                  <button
                    onClick={() => toggleTask(task)}
                    aria-pressed={!!task.isDone}
                    aria-label={task.isDone ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
                    style={{
                      display: 'flex',
                      color: task.isDone ? 'var(--success)' : 'var(--gray-300)',
                      flexShrink: 0,
                    }}
                  >
                    {task.isDone ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                  </button>

                  <button
                    onClick={() => toggleTask(task)}
                    className="u-grow"
                    style={{ textAlign: 'left', minWidth: 0 }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-medium)',
                        color: task.isDone ? 'var(--text-subtle)' : 'var(--text-strong)',
                        textDecoration: task.isDone ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </div>
                    <div style={{ marginTop: 'var(--space-1)' }}>
                      <Badge tone={task.isDone ? 'success' : 'neutral'}>
                        {task.isDone
                          ? `Concluída por ${task.doneBy || 'equipe'}${task.doneAt ? ` · ${formatDateTime(task.doneAt)}` : ''}`
                          : task.time ? `Prevista para ${task.time}` : 'Sem horário definido'}
                      </Badge>
                    </div>
                  </button>

                  {isManager && (
                    <Button
                      variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                      onClick={() => removeTask(task)}
                      aria-label={`Excluir ${task.title}`}
                    />
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <EventFormModal
        open={eventForm.open}
        onClose={() => setEventForm({ open: false, event: null })}
        onSaved={load}
        event={eventForm.event}
        residents={residents}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nova tarefa"
        description="Tarefas aparecem na rotina de todos os cuidadores."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={addTask} loading={saving}>Cadastrar</Button>
          </>
        }
      >
        <form onSubmit={addTask} className="u-stack u-gap-4">
          <TextField
            label="Descrição" required autoFocus
            placeholder="Ex.: Conferir a medicação da manhã"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <TextField
            label="Horário previsto" type="time" required
            value={draft.time}
            onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
