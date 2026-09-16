import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, Pencil, Plus, Trash2, Utensils,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DIAS_SEMANA } from '../lib/format';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHeader, Segmented,
  SelectField, SkeletonList, TextField, useConfirm, useToast,
} from './ui';

const MEAL_TYPES = [
  'Café da Manhã', 'Lanche da Manhã', 'Almoço',
  'Lanche da Tarde', 'Jantar', 'Ceia',
];

const EMPTY_DRAFT = () => ({
  type: 'Café da Manhã',
  time: '08:00',
  menu: '',
  dayOfWeek: new Date().getDay(),
});

/** Refeições antigas não tinham dayOfWeek; deduz pela data gravada. */
function resolveDay(meal, fallback) {
  if (meal.dayOfWeek !== undefined && meal.dayOfWeek !== null) return Number(meal.dayOfWeek);
  if (meal.date) return new Date(meal.date).getDay();
  return fallback;
}

export default function DailyMenu({ role }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('hoje');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const isManager = role === 'admin';
  const today = new Date().getDay();
  const tomorrow = (today + 1) % 7;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('Menu').select('*');
    if (error) {
      toast.error('Não foi possível carregar o cardápio.');
      setMeals([]);
    } else {
      setMeals(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const normalized = useMemo(
    () => meals.map((m) => ({ ...m, day: resolveDay(m, today) })),
    [meals, today]
  );

  const visible = useMemo(() => {
    const target = view === 'hoje' ? today : view === 'amanha' ? tomorrow : null;
    const list = target === null ? [...normalized] : normalized.filter((m) => m.day === target);
    return list.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }, [normalized, view, today, tomorrow]);

  const byDay = useMemo(() => {
    const groups = new Map();
    visible.forEach((m) => {
      if (!groups.has(m.day)) groups.set(m.day, []);
      groups.get(m.day).push(m);
    });
    return groups;
  }, [visible]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT());
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (meal) => {
    setDraft({
      type: meal.type || 'Café da Manhã',
      time: meal.time || '08:00',
      menu: meal.menu || '',
      dayOfWeek: meal.day,
    });
    setEditingId(meal.id);
    setFormOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!draft.menu.trim()) return;

    const payload = {
      type: draft.type,
      time: draft.time,
      menu: draft.menu.trim(),
      dayOfWeek: Number(draft.dayOfWeek),
    };

    setSaving(true);
    const { error } = editingId
      ? await supabase.from('Menu').update(payload).eq('id', editingId)
      : await supabase.from('Menu').insert([{ ...payload, served: false }]);
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar a refeição.');
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    toast.success(editingId ? 'Refeição atualizada.' : 'Refeição adicionada ao cardápio.');
    load();
  };

  const remove = async (meal) => {
    const ok = await confirm({
      title: 'Excluir refeição',
      message: `"${meal.type}" de ${DIAS_SEMANA[meal.day]} será removida do cardápio.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('Menu').delete().eq('id', meal.id);
    if (error) {
      toast.error('Erro ao excluir a refeição.');
      return;
    }
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
    toast.success('Refeição excluída.');
  };

  const toggleServed = async (meal) => {
    const next = !meal.served;
    setMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, served: next } : m)));

    const { error } = await supabase.from('Menu').update({ served: next }).eq('id', meal.id);
    if (error) {
      setMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, served: !next } : m)));
      toast.error('Não foi possível registrar. Verifique a conexão.');
    }
  };

  const renderMeal = (meal) => (
    <Card key={meal.id} accent={meal.served ? 'success' : 'warning'}>
      <CardBody tight>
        <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-2)' }}>
          <div className="u-row u-gap-2" style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 'var(--text-md)' }}>{meal.type}</h3>
            <Badge tone="neutral" icon={Clock}>{meal.time}</Badge>
          </div>
          {meal.served && <Badge tone="success" icon={CheckCircle2}>Servida</Badge>}
        </div>

        <p style={{ color: 'var(--text)', marginBottom: 'var(--space-4)' }}>{meal.menu}</p>

        <div className="u-row u-gap-2">
          {!meal.served && (
            <Button variant="primary" size="sm" icon={Utensils} onClick={() => toggleServed(meal)} className="u-grow">
              Marcar como servida
            </Button>
          )}
          {meal.served && (
            <Button variant="ghost" size="sm" onClick={() => toggleServed(meal)}>
              Desfazer
            </Button>
          )}
          {isManager && (
            <>
              <Button variant="secondary" size="sm" iconOnly icon={Pencil}
                onClick={() => openEdit(meal)} aria-label="Editar refeição" />
              <Button variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                onClick={() => remove(meal)} aria-label="Excluir refeição" />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Cardápio"
        description="Refeições planejadas e o que já foi servido."
        actions={
          isManager && (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Nova refeição
            </Button>
          )
        }
      />

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Segmented
          ariaLabel="Período do cardápio"
          value={view}
          onChange={setView}
          block
          options={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'amanha', label: 'Amanhã' },
            { value: 'semana', label: 'Semana' },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Utensils}
            title="Nenhuma refeição planejada"
            description={
              view === 'semana'
                ? 'O cardápio da semana ainda não foi montado.'
                : `Não há refeições cadastradas para ${view === 'hoje' ? 'hoje' : 'amanhã'}.`
            }
            action={isManager && <Button variant="primary" icon={Plus} onClick={openCreate}>Planejar cardápio</Button>}
          />
        </Card>
      ) : view === 'semana' ? (
        <div className="u-stack u-gap-8">
          {DIAS_SEMANA.map((dayName, idx) => {
            const dayMeals = byDay.get(idx);
            if (!dayMeals?.length) return null;
            return (
              <section key={idx}>
                <div className="u-row u-gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                  <h2 style={{ fontSize: 'var(--text-md)' }}>{dayName}</h2>
                  {idx === today && <Badge tone="primary">Hoje</Badge>}
                </div>
                <div className="grid-cards">{dayMeals.map(renderMeal)}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="list">{visible.map(renderMeal)}</div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar refeição' : 'Nova refeição'}
        description="O cardápio se repete toda semana no dia escolhido."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {editingId ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="u-stack u-gap-4">
          <div className="field-row">
            <SelectField
              label="Dia da semana" icon={CalendarDays}
              value={draft.dayOfWeek}
              onChange={(e) => setDraft((d) => ({ ...d, dayOfWeek: e.target.value }))}
            >
              {DIAS_SEMANA.map((day, idx) => (
                <option key={idx} value={idx}>{day}</option>
              ))}
            </SelectField>

            <SelectField
              label="Refeição"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              {MEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>
          </div>

          <TextField
            label="Horário" type="time" required
            value={draft.time}
            onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
          />

          <TextField
            label="O que será servido" required
            placeholder="Ex.: Arroz, feijão, frango grelhado e salada"
            value={draft.menu}
            onChange={(e) => setDraft((d) => ({ ...d, menu: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
