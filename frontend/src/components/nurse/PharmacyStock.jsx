import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle2, Plus, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PharmacyStock() {
  const [stock, setStock] = useState([]);
  const [residents, setResidents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medQty, setMedQty] = useState('');
  const [medMinQty, setMedMinQty] = useState('');
  const [medOrigin, setMedOrigin] = useState('Farmácia');
  const [medResident, setMedResident] = useState('');
  const [medTimes, setMedTimes] = useState('');
  const [medRecipe, setMedRecipe] = useState(null);

  useEffect(() => {
    fetchStock();
    fetchResidents();
  }, []);

  const fetchStock = async () => {
    const { data } = await supabase.from('Medication').select('*');
    if (data && data.length > 0) {
      // Mescla com prescrições locais para ter horários e morador (caso o backend não tenha sido atualizado)
      const localPrescriptions = JSON.parse(localStorage.getItem('rt_prescriptions') || '{}');
      setStock(data.map(m => ({
        id: m.id,
        name: `${m.name} ${m.dosage}`,
        qty: m.stock,
        minQty: m.minStock,
        status: m.stock > m.minStock ? 'ok' : m.stock > 0 ? 'low' : 'critical',
        origin: localPrescriptions[m.id]?.origin || 'Não informado',
        resident: localPrescriptions[m.id]?.residentName || 'Geral',
        times: localPrescriptions[m.id]?.times || []
      })));
    } else {
      const localStock = JSON.parse(localStorage.getItem('rt_stock') || '[]');
      setStock(localStock);
    }
  };

  const fetchResidents = async () => {
    const { data } = await supabase.from('Resident').select('id, name');
    if (data) setResidents(data);
  };

  const handleAddMed = async () => {
    if (!medName || !medQty || !medResident || !medTimes || !medRecipe) {
      alert("Preencha todos os campos obrigatórios, incluindo o anexo da receita.");
      return;
    }

    const newMed = {
      id: Date.now().toString(),
      name: medName,
      dosage: medDosage,
      stock: parseInt(medQty),
      minStock: parseInt(medMinQty || 10),
    };

    // Tenta salvar no Supabase
    await supabase.from('Medication').insert([{
      name: medName,
      dosage: medDosage,
      stock: parseInt(medQty),
      minStock: parseInt(medMinQty || 10)
    }]);

    // Salva os dados extras (prescrição) no local storage como fallback/extensão
    const localPrescriptions = JSON.parse(localStorage.getItem('rt_prescriptions') || '{}');
    const selectedRes = residents.find(r => r.id === medResident) || { name: 'Geral' };
    
    localPrescriptions[newMed.id] = {
      origin: medOrigin,
      residentId: medResident,
      residentName: selectedRes.name,
      times: medTimes.split(',').map(t => t.trim()),
      recipeAttached: true
    };
    localStorage.setItem('rt_prescriptions', JSON.stringify(localPrescriptions));

    const localStock = JSON.parse(localStorage.getItem('rt_stock') || '[]');
    localStock.push({
      id: newMed.id,
      name: `${newMed.name} ${newMed.dosage}`,
      qty: newMed.stock,
      minQty: newMed.minStock,
      status: newMed.stock > newMed.minStock ? 'ok' : newMed.stock > 0 ? 'low' : 'critical',
      origin: medOrigin,
      resident: selectedRes.name,
      times: localPrescriptions[newMed.id].times
    });
    localStorage.setItem('rt_stock', JSON.stringify(localStock));

    setStock(localStock);
    setShowAddModal(false);
    
    // Reseta form
    setMedName(''); setMedDosage(''); setMedQty(''); setMedMinQty(''); setMedOrigin('Farmácia'); setMedResident(''); setMedTimes(''); setMedRecipe(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ marginBottom: '8px' }}>Estoque & Prescrições</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Gerencie as medicações e as receitas dos moradores.
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={() => setShowAddModal(true)}>
          <Plus size={20} />
          Cadastrar Remédio
        </button>
      </div>

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
            <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Morador: {item.resident}</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Mínimo: {item.minQty} un. | Origem: {item.origin} | Horários: {item.times?.join(', ')}
            </p>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: item.status === 'critical' ? 'var(--danger)' : 'var(--text-main)' }}>
              {item.qty} un.
            </div>
            {item.status === 'ok' && <span style={{ color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}><CheckCircle2 size={16}/> Em dia</span>}
            {item.status === 'low' && <span style={{ color: 'var(--warning)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}><AlertTriangle size={16}/> Atenção</span>}
            {item.status === 'critical' && <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}><AlertTriangle size={16}/> Urgente</span>}
          </div>
        </div>
      ))}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '32px', margin: '40px 0' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary-dark)' }}>Cadastrar Novo Medicamento</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="input-label">Nome do Remédio *</label>
                <input type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medName} onChange={e => setMedName(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Dosagem (Ex: 50mg)</label>
                <input type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medDosage} onChange={e => setMedDosage(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label className="input-label">Qtd Atual (un) *</label>
                <input type="number" className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medQty} onChange={e => setMedQty(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Estoque Mínimo *</label>
                <input type="number" className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medMinQty} onChange={e => setMedMinQty(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label className="input-label">Origem *</label>
                <select className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medOrigin} onChange={e => setMedOrigin(e.target.value)}>
                  <option>Farmácia</option>
                  <option>SUS</option>
                </select>
              </div>
              <div>
                <label className="input-label">Morador *</label>
                <select className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medResident} onChange={e => setMedResident(e.target.value)}>
                  <option value="">Selecione...</option>
                  {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label className="input-label">Horários (Separados por vírgula. Ex: 08:00, 20:00) *</label>
              <input type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={medTimes} onChange={e => setMedTimes(e.target.value)} />
            </div>

            <div style={{ marginTop: '20px', padding: '16px', border: '1px dashed var(--primary)', borderRadius: '8px', textAlign: 'center', background: 'var(--primary-light)' }}>
              <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Anexar Receita Médica *</label>
              <input type="file" id="recipe-upload" style={{ display: 'none' }} onChange={(e) => setMedRecipe(e.target.files[0])} accept="image/*,.pdf" />
              <label htmlFor="recipe-upload" className="btn" style={{ background: 'white', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Paperclip size={18} /> {medRecipe ? medRecipe.name : 'Escolher Arquivo PDF/Imagem'}
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddMed}>Salvar Medicamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
