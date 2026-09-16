import { useCallback, useEffect, useState } from 'react';
import {
  Apple, Cake, Pencil, Plus, Save, Trash2, TriangleAlert, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { calcAge, formatDate } from '../../lib/format';
import { AUTONOMY_LEVELS } from '../../lib/clinical';
import {
  Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, SelectField,
  SkeletonList, Table, Tabs, TextField, useConfirm, useToast,
} from '../ui';

const FOOD_CATEGORIES = ['Básico', 'Limpeza', 'Higiene', 'Verduras', 'Proteínas', 'Moradores'];
const FOOD_UNITS = ['unidades', 'kg', 'litros', 'pacotes'];

const EMPTY_RESIDENT = {
  name: '', cpf: '', dateOfBirth: '', sex: '', conditions: '', allergies: '',
  autonomy_hygiene: '', autonomy_food: '', autonomy_activities: '',
};
const EMPTY_FOOD = { name: '', category: 'Básico', unit: 'unidades', quantity: '', minQuantity: '' };

export default function DataRegistration() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('moradores');
  const [residents, setResidents] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [resident, setResident] = useState(EMPTY_RESIDENT);
  const [food, setFood] = useState(EMPTY_FOOD);

  const isResidents = tab === 'moradores';

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === 'moradores') {
      const { data, error } = await supabase.from('Resident').select('*').order('name');
      if (error) toast.error('Não foi possível carregar os moradores.');
      setResidents(data || []);
    } else {
      const { data, error } = await supabase.from('FoodItem').select('*').order('name');
      if (error) toast.error('Não foi possível carregar a despensa.');
      setFoods(data || []);
    }
    setLoading(false);
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setResident(EMPTY_RESIDENT);
    setFood(EMPTY_FOOD);
  };

  const openCreate = () => {
    setEditingId(null);
    setResident(EMPTY_RESIDENT);
    setFood(EMPTY_FOOD);
    setFormOpen(true);
  };

  const openEditResident = (r) => {
    setResident({
      name: r.name || '',
      cpf: r.cpf || '',
      dateOfBirth: r.dateOfBirth ? String(r.dateOfBirth).split('T')[0] : '',
      sex: r.sex || '',
      conditions: r.conditions || '',
      allergies: r.allergies || '',
      autonomy_hygiene: r.autonomy_hygiene || '',
      autonomy_food: r.autonomy_food || '',
      autonomy_activities: r.autonomy_activities || '',
    });
    setEditingId(r.id);
    setFormOpen(true);
  };

  const openEditFood = (f) => {
    setFood({
      name: f.name || '',
      category: f.category || 'Básico',
      unit: f.unit || 'unidades',
      quantity: f.quantity ?? '',
      minQuantity: f.minQuantity ?? '',
    });
    setEditingId(f.id);
    setFormOpen(true);
  };

  const saveResident = async (e) => {
    e.preventDefault();
    if (!resident.name.trim()) return;

    setSaving(true);
    const payload = {
      ...resident,
      name: resident.name.trim(),
      dateOfBirth: resident.dateOfBirth
        ? new Date(`${resident.dateOfBirth}T12:00:00`).toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from('Resident').update(payload).eq('id', editingId)
      : await supabase.from('Resident').insert([{ id: uid(), ...payload }]);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(editingId ? 'Morador atualizado.' : 'Morador cadastrado.');
    closeForm();
    load();
  };

  const saveFood = async (e) => {
    e.preventDefault();
    if (!food.name.trim()) return;

    setSaving(true);
    const payload = {
      ...food,
      name: food.name.trim(),
      quantity: parseFloat(food.quantity) || 0,
      minQuantity: parseFloat(food.minQuantity) || 0,
      updatedAt: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from('FoodItem').update(payload).eq('id', editingId)
      : await supabase.from('FoodItem').insert([{ id: uid(), ...payload }]);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(editingId ? 'Item atualizado.' : 'Item cadastrado.');
    closeForm();
    load();
  };

  const removeResident = async (r) => {
    const ok = await confirm({
      title: 'Excluir morador',
      message: `${r.name} será removido do cadastro.`,
      warning:
        'Plantões, sinais vitais e relatórios já lançados continuam no banco, mas deixarão de exibir o nome corretamente. Prefira desativar o morador quando essa opção existir.',
      confirmLabel: 'Excluir mesmo assim',
    });
    if (!ok) return;

    const { error } = await supabase.from('Resident').delete().eq('id', r.id);
    if (error) {
      toast.error('Erro ao excluir o morador.');
      return;
    }
    toast.success('Morador excluído.');
    load();
  };

  const removeFood = async (f) => {
    const ok = await confirm({
      title: 'Excluir item',
      message: `"${f.name}" será removido da despensa.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('FoodItem').delete().eq('id', f.id);
    if (error) {
      toast.error('Erro ao excluir o item.');
      return;
    }
    toast.success('Item excluído.');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Central de cadastros"
        description="Moradores da residência e itens de despensa."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {isResidents ? 'Novo morador' : 'Novo item'}
          </Button>
        }
      />

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Tabs
          ariaLabel="Tipo de cadastro"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'moradores', label: 'Moradores', icon: Users, count: residents.length || undefined },
            { value: 'despensa', label: 'Despensa', icon: Apple, count: foods.length || undefined },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : isResidents ? (
        residents.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title="Nenhum morador cadastrado"
              description="O cadastro dos moradores é a base de toda a operação: plantões, medicação e relatórios dependem dele."
              action={<Button variant="primary" icon={Plus} onClick={openCreate}>Cadastrar morador</Button>}
            />
          </Card>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Morador</th>
                <th>CPF</th>
                <th>Nascimento</th>
                <th>Condições clínicas</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => {
                const age = calcAge(r.dateOfBirth);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="u-row u-gap-3">
                        <Avatar name={r.name} size="sm" />
                        <span className="table__cell-strong">{r.name}</span>
                      </div>
                    </td>
                    <td className="table__cell-muted">{r.cpf || '—'}</td>
                    <td className="table__cell-muted" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.dateOfBirth)}
                      {age != null && (
                        <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                          {' '}· {age} anos
                        </span>
                      )}
                    </td>
                    <td className="table__cell-muted">
                      {r.conditions || '—'}
                    </td>
                    <td>
                      {r.allergies ? (
                        <Badge tone="danger" icon={TriangleAlert}>{r.allergies}</Badge>
                      ) : (
                        <span className="table__cell-muted">Nenhuma</span>
                      )}
                    </td>
                    <td>
                      <div className="table__actions">
                        <Button
                          variant="ghost" size="sm" iconOnly icon={Pencil}
                          onClick={() => openEditResident(r)} aria-label={`Editar ${r.name}`}
                        />
                        <Button
                          variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                          onClick={() => removeResident(r)} aria-label={`Excluir ${r.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )
      ) : foods.length === 0 ? (
        <Card>
          <EmptyState
            icon={Apple}
            title="Despensa vazia"
            description="Cadastre mantimentos, higiene e limpeza para acompanhar o consumo e gerar a lista de compras."
            action={<Button variant="primary" icon={Plus} onClick={openCreate}>Cadastrar item</Button>}
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Categoria</th>
              <th>Estoque atual</th>
              <th>Mínimo</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => {
              const low = (f.quantity ?? 0) <= (f.minQuantity ?? 0);
              return (
                <tr key={f.id}>
                  <td className="table__cell-strong">{f.name}</td>
                  <td><Badge tone="neutral">{f.category}</Badge></td>
                  <td className="table__cell-num">
                    <span style={{ color: low ? 'var(--danger)' : 'var(--text-strong)', fontWeight: 'var(--weight-semibold)' }}>
                      {f.quantity} {f.unit}
                    </span>
                  </td>
                  <td className="table__cell-muted table__cell-num">{f.minQuantity} {f.unit}</td>
                  <td>
                    <div className="table__actions">
                      <Button
                        variant="ghost" size="sm" iconOnly icon={Pencil}
                        onClick={() => openEditFood(f)} aria-label={`Editar ${f.name}`}
                      />
                      <Button
                        variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                        onClick={() => removeFood(f)} aria-label={`Excluir ${f.name}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* ----------------------- Formulários ----------------------- */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={
          isResidents
            ? editingId ? 'Editar morador' : 'Novo morador'
            : editingId ? 'Editar item' : 'Novo item de despensa'
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button
              variant="primary" icon={Save} loading={saving}
              onClick={isResidents ? saveResident : saveFood}
            >
              Salvar
            </Button>
          </>
        }
      >
        {isResidents ? (
          <form onSubmit={saveResident} className="u-stack u-gap-4">
            <TextField
              label="Nome completo" required autoFocus
              value={resident.name}
              onChange={(e) => setResident((r) => ({ ...r, name: e.target.value }))}
            />
            <div className="field-row">
              <TextField
                label="CPF" placeholder="000.000.000-00"
                value={resident.cpf}
                onChange={(e) => setResident((r) => ({ ...r, cpf: e.target.value }))}
              />
              <TextField
                label="Data de nascimento" type="date" icon={Cake}
                value={resident.dateOfBirth}
                onChange={(e) => setResident((r) => ({ ...r, dateOfBirth: e.target.value }))}
              />
            </div>
            <SelectField
              label="Sexo"
              hint="Consta no cabeçalho da ficha de acompanhamento mensal."
              value={resident.sex}
              onChange={(e) => setResident((r) => ({ ...r, sex: e.target.value }))}
            >
              <option value="">Não informado</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </SelectField>
            <TextField
              label="Condições clínicas"
              hint="Separe por vírgula. Alimenta o resumo da ficha mensal."
              placeholder="Ex.: diabético, hipertensivo, esquizofrênico"
              value={resident.conditions}
              onChange={(e) => setResident((r) => ({ ...r, conditions: e.target.value }))}
            />

            <TextField
              label="Alergias"
              hint="Somente alergias e reações adversas. Aparece em destaque na passagem de plantão."
              placeholder="Ex.: dipirona, penicilina, frutos do mar"
              value={resident.allergies}
              onChange={(e) => setResident((r) => ({ ...r, allergies: e.target.value }))}
            />

            <div>
              <p className="divider-label" style={{ marginBottom: 'var(--space-3)' }}>
                Nível de autonomia
              </p>
              <div className="field-row">
                {[
                  ['Higiene pessoal', 'autonomy_hygiene'],
                  ['Alimentação', 'autonomy_food'],
                  ['Atividades diárias', 'autonomy_activities'],
                ].map(([label, field]) => (
                  <SelectField
                    key={field}
                    label={label}
                    value={resident[field]}
                    onChange={(e) => setResident((r) => ({ ...r, [field]: e.target.value }))}
                  >
                    <option value="">Não avaliado</option>
                    {AUTONOMY_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </SelectField>
                ))}
              </div>
              <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                Preenche automaticamente a seção NÍVEL DE AUTONOMIA da ficha mensal.
                Revise ao fechar cada mês.
              </span>
            </div>
          </form>
        ) : (
          <form onSubmit={saveFood} className="u-stack u-gap-4">
            <TextField
              label="Nome do item" required autoFocus
              placeholder="Ex.: Arroz tipo 1"
              value={food.name}
              onChange={(e) => setFood((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="field-row">
              <SelectField
                label="Categoria"
                value={food.category}
                onChange={(e) => setFood((f) => ({ ...f, category: e.target.value }))}
              >
                {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectField>
              <SelectField
                label="Unidade"
                value={food.unit}
                onChange={(e) => setFood((f) => ({ ...f, unit: e.target.value }))}
              >
                {FOOD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </SelectField>
            </div>
            <div className="field-row">
              <TextField
                label="Estoque atual" type="number" step="0.01" min="0" required
                value={food.quantity}
                onChange={(e) => setFood((f) => ({ ...f, quantity: e.target.value }))}
              />
              <TextField
                label="Estoque mínimo" type="number" step="0.01" min="0" required
                hint="Dispara o alerta de compra"
                value={food.minQuantity}
                onChange={(e) => setFood((f) => ({ ...f, minQuantity: e.target.value }))}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
