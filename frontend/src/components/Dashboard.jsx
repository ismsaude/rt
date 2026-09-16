import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, CheckCircle2, Circle, Clock, ListChecks, MapPin, Plus, Trash2, User,
} from 'lucide-react';
import { formatDateTime, toISODate } from '../lib/format';
import { SOCIAL_EVENT_TYPES } from '../lib/clinical';
import { supabase } from '../lib/supabase';
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, PageHeader,
  SkeletonList, TextField, useConfirm, useToast,
} from './ui';

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

    const [{ data, error }, { data: evs }] = await Promise.all([
      supabase.from('Task').select('*'),
      supabase.from('Event').select('*').eq('date', hoje),
    ]);

    if (error) {
      toast.error('Não foi possível carregar as tarefas.');
      setTasks([]);
    } else {
      setTasks(sortTasks(data || []));
    }

    setEvents(
      (evs || []).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    );
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
        title="Tarefas do dia"
        description={
          tasks.length > 0
            ? `${done} de ${tasks.length} concluídas na rotina da casa.`
            : 'Rotina de cuidados e organização da residência.'
        }
        actions={
          isManager && (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Nova tarefa
            </Button>
          )
        }
      />

      {/* Compromissos do dia — a cuidadora precisa saber que alguém
          sai para consulta antes de planejar o resto da rotina. */}
      {!loading && events.length > 0 && (
        <Card accent="warning" style={{ marginBottom: 'var(--space-5)' }}>
          <CardHeader
            icon={CalendarClock}
            title={
              events.length === 1
                ? '1 compromisso hoje'
                : `${events.length} compromissos hoje`
            }
            subtitle="Consultas, exames e saídas agendadas para a casa"
          />
          <CardBody tight>
            <div className="u-stack u-gap-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    alignItems: 'flex-start',
                  }}
                >
                  <Badge tone="warning" icon={Clock}>{ev.time}</Badge>
                  <div className="u-grow" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {ev.title}
                    </div>
                    <div
                      className="u-row u-wrap u-gap-3 u-muted"
                      style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}
                    >
                      <span className="u-row u-gap-1">
                        <User size={13} aria-hidden="true" /> {ev.resident_name}
                      </span>
                      {ev.location && (
                        <span className="u-row u-gap-1">
                          <MapPin size={13} aria-hidden="true" /> {ev.location}
                        </span>
                      )}
                    </div>
                    {ev.notes && (
                      <p
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--warning-text)',
                          marginTop: 'var(--space-2)',
                          fontWeight: 'var(--weight-medium)',
                        }}
                      >
                        {ev.notes}
                      </p>
                    )}
                  </div>
                  {ev.type && (
                    <Badge tone={SOCIAL_EVENT_TYPES.includes(ev.type) ? 'success' : 'info'}>
                      {ev.type}
                    </Badge>
                  )}
                </div>
              ))}
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
