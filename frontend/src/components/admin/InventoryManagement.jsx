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
        items.push(...foodData.map(f => {
          let st = 'ok';
          if (f.quantity < f.minQuantity) st = 'critical';
          else if (f.quantity === f.minQuantity) st = 'buy';
          else if (f.quantity === f.minQuantity + 1) st = 'alert';
          return {
            id: f.id,
            name: f.name,
            category: f.category,
            qty: f.quantity,
            minQty: f.minQuantity,
            status: st
          };
        }));
      }
      if (medData) {
        items.push(...medData.map(m => {
          let st = 'ok';
          if (m.stock < m.minStock) st = 'critical';
          else if (m.stock === m.minStock) st = 'buy';
          else if (m.stock === m.minStock + 1) st = 'alert';
          return {
            id: m.id,
            name: `${m.name} ${m.dosage}`,
            category: 'Farmácia',
            qty: m.stock,
            minQty: m.minStock,
            status: st
          };
        }));
      }
      setInventory(items);
    };
    fetchInventory();
  }, []);

  const needsPurchase = inventory.filter(i => i.qty <= i.minQty).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ marginBottom: '4px' }}>Estoque e Compras</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Gerencie mantimentos e farmácia.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--secondary)' }}>
          <ShoppingCart size={18} />
          Lista de Compras ({needsPurchase})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {inventory.map(item => (
          <div key={item.id} className="card" style={{ padding: '16px', background: item.status === 'critical' ? 'var(--danger-light)' : 'var(--surface)', borderLeft: item.status === 'critical' ? '4px solid var(--danger)' : item.status === 'buy' ? '4px solid var(--warning)' : item.status === 'alert' ? '4px solid #d97706' : '4px solid var(--secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageOpen size={18} color="var(--text-muted)" />
                {item.name}
              </div>
              <span style={{ border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', background: 'var(--background)' }}>{item.category}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
               <div style={{ display: 'flex', gap: '24px' }}>
                 <div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Estoque Atual</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: item.status === 'critical' ? 'var(--danger)' : 'var(--text-main)' }}>{item.qty}</div>
                 </div>
                 <div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Mínimo</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{item.minQty}</div>
                 </div>
               </div>
               
               <div style={{ textAlign: 'right' }}>
                  {item.status === 'ok' && <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>Em dia</span>}
                  {item.status === 'alert' && <span style={{ color: '#d97706', fontWeight: 'bold' }}>Alerta</span>}
                  {item.status === 'buy' && <span style={{ color: 'var(--warning)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><ShoppingCart size={16}/> Comprar</span>}
                  {item.status === 'critical' && <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16}/> Urgente</span>}
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
