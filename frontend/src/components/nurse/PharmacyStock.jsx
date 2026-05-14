import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PharmacyStock() {
  const [stock, setStock] = useState([]);

  useEffect(() => {
    const fetchStock = async () => {
      const { data } = await supabase.from('Medication').select('*');
      if (data) {
        setStock(data.map(m => ({
          id: m.id,
          name: `${m.name} ${m.dosage}`,
          qty: m.stock,
          minQty: m.minStock,
          status: m.stock > m.minStock ? 'ok' : m.stock > 0 ? 'low' : 'critical'
        })));
      }
    };
    fetchStock();
  }, []);

  return (
    <div>
      <h2>Estoque da Farmácia</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '20px' }}>
        Verifique as medicações que precisam de reposição.
      </p>

      {stock.map(item => (
        <div 
          key={item.id} 
          className="card" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderLeft: item.status === 'ok' ? '6px solid var(--secondary)' : item.status === 'low' ? '6px solid var(--warning)' : '6px solid var(--danger)'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{item.name}</h3>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
              Mínimo: {item.minQty} un.
            </p>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: item.status === 'critical' ? 'var(--danger)' : 'var(--text-main)' }}>
              {item.qty} un.
            </div>
            {item.status === 'ok' && <span style={{ color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={16}/> Em dia</span>}
            {item.status === 'low' && <span style={{ color: 'var(--warning)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16}/> Atenção</span>}
            {item.status === 'critical' && <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16}/> Urgente</span>}
          </div>
        </div>
      ))}

      <button className="btn-massive btn-primary" style={{ marginTop: '20px' }}>
        <Package size={28} />
        Solicitar Reposição
      </button>
    </div>
  );
}
