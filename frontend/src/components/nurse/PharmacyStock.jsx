import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Package, Paperclip, Plus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { loadMedications } from '../../lib/medications';
import {
  Badge, Button, Card, CardBody, EmptyState, Field, Modal, PageHeader,
  SelectField, SkeletonList, TextField, useToast,
} from '../ui';

const EMPTY_FORM = {
  name: '', dosage: '', qty: '', minQty: '10',
  origin: 'Farmácia', residentId: '', times: '', recipe: null,
};

function stockStatus(qty, minQty) {
  if (qty <= 0) return 'critical';
  if (qty <= minQty) return 'low';
  return 'ok';
}

const STATUS_META = {
  ok:       { tone: 'success', label: 'Em dia',  icon: CheckCircle2, accent: 'success' },
  low:      { tone: 'warning', label: 'Repor',   icon: AlertTriangle, accent: 'warning' },
  critical: { tone: 'danger',  label: 'Urgente', icon: AlertTriangle, accent: 'danger' },
};

export default function PharmacyStock() {
  const toast = useToast();

  const [stock, setStock] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);

    const [{ data: meds, error: medError }, { data: res }] = await Promise.all([
      loadMedications(),
      supabase.from('Resident').select('id, name').order('name'),
    ]);

    if (medError) toast.error('Não foi possível carregar o estoque.');
    setResidents(res || []);
    setStock(
      (meds || []).map((m) => ({
        id: m.id,
        name: [m.name, m.dosage].filter(Boolean).join(' '),
        qty: m.stock ?? 0,
        minQty: m.minStock ?? 0,
        origin: m.origin || 'Não informado',
        resident: m.resident_name || 'Geral',
        times: m.times || [],
      }))
    );
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.qty || !form.residentId || !form.times.trim()) {
      toast.warning('Preencha nome, quantidade, morador e horários.');
      return;
    }

    setSaving(true);
    const resident = residents.find((r) => r.id === form.residentId);

    // Horários aceitos como "8", "08:00" ou "8h"; normalizados para HH:MM.
    const times = form.times
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const m = t.match(/^(\d{1,2})(?::?(\d{2}))?/);
        if (!m) return null;
        return `${m[1].padStart(2, '0')}:${m[2] || '00'}`;
      })
      .filter(Boolean)
      .sort();

    if (times.length === 0) {
      setSaving(false);
      toast.warning('Informe ao menos um horário válido, como 08:00.');
      return;
    }

    const { error } = await supabase.from('Medication').insert([{
      id: uid(),
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      stock: parseInt(form.qty, 10),
      minStock: parseInt(form.minQty || '10', 10),
      resident_id: form.residentId,
      resident_name: resident?.name || 'Geral',
      times,
      origin: form.origin,
      active: true,
    }]);

    setSaving(false);

    if (error) {
      toast.error(
        /column .* does not exist|schema cache/i.test(error.message || '')
          ? 'O banco ainda não tem as colunas de morador e horários. Rode a migração 007.'
          : `Erro ao cadastrar: ${error.message}`
      );
      return;
    }

    setForm(EMPTY_FORM);
    setFormOpen(false);
    toast.success(`Medicamento cadastrado para ${resident?.name}.`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Estoque e prescrições"
        description="Medicamentos da casa, horários e níveis de reposição."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
            Cadastrar medicamento
          </Button>
        }
      />

      {loading ? (
        <SkeletonList count={3} />
      ) : stock.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Estoque vazio"
            description="Cadastre os medicamentos em uso pelos moradores para acompanhar o consumo."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                Cadastrar medicamento
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="list">
          {stock.map((item) => {
            const status = stockStatus(item.qty, item.minQty);
            const meta = STATUS_META[status];
            return (
              <Card key={item.id} accent={meta.accent}>
                <CardBody tight>
                  <div className="u-between u-gap-4 u-wrap">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>
                        {item.name}
                      </h3>
                      <div className="u-row u-wrap u-gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                        <Badge tone="primary">{item.resident}</Badge>
                        <Badge tone="neutral">{item.origin}</Badge>
                      </div>
                      <p className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                        {item.times?.length
                          ? `Horários: ${item.times.join(' · ')}`
                          : 'Sem horários definidos'}
                        {' · '}
                        Mínimo: {item.minQty} un.
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--text-2xl)',
                          fontWeight: 'var(--weight-semibold)',
                          color: status === 'ok' ? 'var(--text-strong)' : `var(--${status === 'low' ? 'warning' : 'danger'})`,
                          lineHeight: 1.1,
                        }}
                      >
                        {item.qty}
                      </div>
                      <div className="u-subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
                        unidades
                      </div>
                      <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Cadastrar medicamento"
        description="Vincule o medicamento ao morador e informe os horários de administração."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={submit} loading={saving}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={submit} className="u-stack u-gap-4">
          <div className="field-row">
            <TextField
              label="Nome do medicamento" required autoFocus
              placeholder="Ex.: Risperidona"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Dosagem"
              placeholder="Ex.: 2mg"
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            />
          </div>

          <div className="field-row">
            <TextField
              label="Quantidade atual" type="number" min="0" required
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
            <TextField
              label="Estoque mínimo" type="number" min="0" required
              hint="Dispara o alerta de reposição"
              value={form.minQty}
              onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
            />
          </div>

          <div className="field-row">
            <SelectField
              label="Origem"
              value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            >
              <option>Farmácia</option>
              <option>SUS</option>
            </SelectField>

            <SelectField
              label="Morador" required
              value={form.residentId}
              onChange={(e) => setForm((f) => ({ ...f, residentId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
          </div>

          <TextField
            label="Horários de administração" required
            hint="Separe por vírgula. Ex.: 08:00, 14:00, 20:00 — estes horários aparecem na checagem diária."
            placeholder="08:00, 20:00"
            value={form.times}
            onChange={(e) => setForm((f) => ({ ...f, times: e.target.value }))}
          />

          <Field label="Receita médica" hint="Imagem ou PDF da prescrição.">
            <label
              className="btn btn--secondary btn--md"
              style={{ cursor: 'pointer', width: '100%' }}
            >
              <Paperclip size={17} aria-hidden="true" />
              {form.recipe ? form.recipe.name : 'Escolher arquivo'}
              <input
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => setForm((f) => ({ ...f, recipe: e.target.files?.[0] || null }))}
              />
            </label>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
