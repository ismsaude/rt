import React, { useState, useEffect } from 'react';
import { PackageOpen, ShoppingCart, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function InventoryManagement() {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const fetchInventory = async () => {
      const { data: foodData } = await supabase.from('FoodItem').select('*');
      const { data: medData } = await supabase.from('Medication').select('*');
      
      const items = [];
      if (foodData) {
        items.push(...foodData.map(f => ({
          id: f.id,
          name: f.name,
          category: f.category,
          qty: f.quantity,
          minQty: f.minQuantity,
          status: f.quantity >= f.minQuantity ? 'ok' : f.quantity > 0 ? 'low' : 'critical'
        })));
      }
      if (medData) {
        items.push(...medData.map(m => ({
          id: m.id,
          name: `${m.name} ${m.dosage}`,
          category: 'Farmácia',
          qty: m.stock,
          minQty: m.minStock,
          status: m.stock >= m.minStock ? 'ok' : m.stock > 0 ? 'low' : 'critical'
        })));
      }
      setInventory(items);
    };
    fetchInventory();
  }, []);

  const needsPurchase = inventory.filter(i => i.qty <= i.minQty).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Estoque e Compras</h2>
          <p style={{ color: 'var(--text-muted)' }}>Gerencie os mantimentos e a farmácia da residência.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem', background: 'var(--secondary)' }}>
          <ShoppingCart size={20} />
          Gerar Lista de Compras ({needsPurchase} itens)
        </button>
      </div>

      <table className="desktop-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Categoria</th>
            <th>Estoque Atual</th>
            <th>Mínimo Ideal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map(item => (
            <tr key={item.id} style={{ background: item.status === 'critical' ? 'var(--danger-light)' : 'transparent' }}>
              <td style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageOpen size={18} color="var(--text-muted)" />
                {item.name}
              </td>
              <td><span style={{ border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>{item.category}</span></td>
              <td style={{ fontSize: '1.2rem', fontWeight: 'bold', color: item.status === 'critical' ? 'var(--danger)' : 'var(--text-main)' }}>{item.qty}</td>
              <td style={{ color: 'var(--text-muted)' }}>{item.minQty}</td>
              <td>
                {item.status === 'ok' && <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>Em dia</span>}
                {item.status === 'low' && <span style={{ color: 'var(--warning)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16}/> Comprar logo</span>}
                {item.status === 'critical' && <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16}/> Urgente</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
