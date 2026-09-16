import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CheckSquare, PackageOpen, ShoppingCart, Square,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Badge, Button, Card, CardBody, EmptyState, Modal, PageHeader, Segmented,
  SkeletonList, Stat, StatGrid, useToast,
} from '../ui';

function statusOf(qty, minQty) {
  if (qty < minQty) return 'critical';
  if (qty === minQty) return 'buy';
  if (qty <= minQty + 1) return 'alert';
  return 'ok';
}

const STATUS_META = {
  ok:       { tone: 'success', label: 'Em dia',   accent: undefined, icon: CheckCircle2 },
  alert:    { tone: 'warning', label: 'Atenção',  accent: 'warning', icon: AlertTriangle },
  buy:      { tone: 'warning', label: 'Comprar',  accent: 'warning', icon: ShoppingCart },
  critical: { tone: 'danger',  label: 'Urgente',  accent: 'danger',  icon: AlertTriangle },
};

export default function InventoryManagement() {
  const toast = useToast();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [listOpen, setListOpen] = useState(false);
  const [checked, setChecked] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: foods, error: foodError }, { data: meds, error: medError }] = await Promise.all([
      supabase.from('FoodItem').select('*'),
      supabase.from('Medication').select('*'),
    ]);

    if (foodError || medError) toast.error('Não foi possível carregar o estoque completo.');

    const items = [
      ...(foods || []).map((f) => ({
        id: `food-${f.id}`,
        name: f.name,
        category: f.category || 'Despensa',
        group: 'despensa',
        qty: f.quantity ?? 0,
        minQty: f.minQuantity ?? 0,
        unit: f.unit || 'un',
      })),
      ...(meds || []).map((m) => ({
        id: `med-${m.id}`,
        name: [m.name, m.dosage].filter(Boolean).join(' '),
        category: 'Farmácia',
        group: 'farmacia',
        qty: m.stock ?? 0,
        minQty: m.minStock ?? 0,
        unit: 'un',
      })),
    ].map((item) => ({ ...item, status: statusOf(item.qty, item.minQty) }));

    setInventory(items);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const shoppingItems = useMemo(
    () => inventory.filter((i) => i.qty <= i.minQty),
    [inventory]
  );

  const visible = useMemo(() => {
    if (filter === 'todos') return inventory;
    if (filter === 'repor') return shoppingItems;
    return inventory.filter((i) => i.group === filter);
  }, [inventory, filter, shoppingItems]);

  const criticalCount = inventory.filter((i) => i.status === 'critical').length;

  return (
    <div>
      <PageHeader
        title="Estoque e compras"
        description="Despensa e farmácia da residência em uma só visão."
        actions={
          <Button
            variant="primary" icon={ShoppingCart}
            onClick={() => setListOpen(true)}
            disabled={shoppingItems.length === 0}
          >
            Lista de compras ({shoppingItems.length})
          </Button>
        }
      />

      {!loading && (
        <StatGrid style={{ marginBottom: 'var(--space-6)' }}>
          <Stat label="Itens cadastrados" value={inventory.length} icon={PackageOpen} />
          <Stat
            label="Precisam reposição" value={shoppingItems.length}
            tone={shoppingItems.length > 0 ? 'warning' : 'default'} icon={ShoppingCart}
          />
          <Stat
            label="Em falta" value={criticalCount}
            tone={criticalCount > 0 ? 'danger' : 'default'} icon={AlertTriangle}
          />
        </StatGrid>
      )}

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Segmented
          ariaLabel="Filtrar estoque"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'repor', label: 'Repor' },
            { value: 'despensa', label: 'Despensa' },
            { value: 'farmacia', label: 'Farmácia' },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={filter === 'repor' ? CheckCircle2 : PackageOpen}
            title={filter === 'repor' ? 'Nada para comprar' : 'Nenhum item neste filtro'}
            description={
              filter === 'repor'
                ? 'Todos os itens estão acima do estoque mínimo.'
                : 'Cadastre itens na Central de Cadastros ou no Estoque de Enfermagem.'
            }
          />
        </Card>
      ) : (
        <div className="list">
          {visible.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <Card key={item.id} accent={meta.accent}>
                <CardBody tight>
                  <div className="u-between u-gap-4 u-wrap">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="u-row u-gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                        <PackageOpen size={15} color="var(--text-subtle)" aria-hidden="true" />
                        <strong style={{ color: 'var(--text-strong)' }}>{item.name}</strong>
                      </div>
                      <Badge tone="neutral">{item.category}</Badge>
                    </div>

                    <div className="u-row u-gap-6">
                      <div>
                        <div className="stat__label">Atual</div>
                        <div
                          style={{
                            fontSize: 'var(--text-lg)',
                            fontWeight: 'var(--weight-semibold)',
                            color: item.status === 'critical' ? 'var(--danger)' : 'var(--text-strong)',
                          }}
                        >
                          {item.qty} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div className="stat__label">Mínimo</div>
                        <div
                          style={{
                            fontSize: 'var(--text-lg)',
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {item.minQty} {item.unit}
                        </div>
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
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="Lista de compras"
        description="Toque nos itens conforme forem colocados no carrinho."
        footer={<Button variant="primary" onClick={() => setListOpen(false)}>Concluir</Button>}
      >
        {shoppingItems.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nada para comprar" />
        ) : (
          <div className="u-stack u-gap-2">
            {shoppingItems.map((item) => {
              const isChecked = !!checked[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3)', textAlign: 'left',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    background: isChecked ? 'var(--surface-sunken)' : 'var(--surface)',
                    opacity: isChecked ? 0.6 : 1,
                    transition: 'all var(--duration-fast)',
                  }}
                >
                  <span style={{ color: isChecked ? 'var(--success)' : 'var(--text-subtle)', display: 'flex' }}>
                    {isChecked ? <CheckSquare size={22} /> : <Square size={22} />}
                  </span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 'var(--weight-medium)',
                        color: 'var(--text-strong)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                    >
                      {item.name}
                    </span>
                    <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                      {item.category} · restam {item.qty} {item.unit}
                    </span>
                  </span>
                  {item.status === 'critical' && !isChecked && <Badge tone="danger">Urgente</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
