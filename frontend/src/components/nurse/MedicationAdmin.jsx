import React, { useState } from 'react';
import { Pill, CheckCircle2, XCircle, Send, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MedicationAdmin() {
  const [meds, setMeds] = useState([]);
  const [currentTimeFilter, setCurrentTimeFilter] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [stockAlert, setStockAlert] = useState(null);

  const [refusingId, setRefusingId] = useState(null);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    // Busca do banco
    const { data } = await supabase.from('Medication').select('*');
    const localPrescriptions = JSON.parse(localStorage.getItem('rt_prescriptions') || '{}');
    const localStock = JSON.parse(localStorage.getItem('rt_stock') || '[]');

    let allMeds = [];
    let timesSet = new Set();

    // Se houver no localStock (que contém os horários simulados criados no PharmacyStock)
    if (localStock.length > 0) {
      localStock.forEach(item => {
        if (item.times) {
          item.times.forEach(t => {
            timesSet.add(t);
            allMeds.push({
              id: `${item.id}-${t}`,
              realId: item.id,
              name: item.name,
              resident: item.resident,
              time: t,
              status: 'pending',
              qty: item.qty,
              minQty: item.minQty
            });
          });
        }
      });
    }

    const timesArray = Array.from(timesSet).sort();
    setAvailableTimes(timesArray);
    if (timesArray.length > 0) setCurrentTimeFilter(timesArray[0]);

    setMeds(allMeds);
  };

  const handleAdminister = async (id, realId) => {
    setMeds(meds.map(m => m.id === id ? { ...m, status: 'administered' } : m));
    
    // Desconta do estoque
    const localStock = JSON.parse(localStorage.getItem('rt_stock') || '[]');
    const stockItemIndex = localStock.findIndex(s => s.id === realId);
    
    if (stockItemIndex >= 0) {
      localStock[stockItemIndex].qty -= 1;
      const newQty = localStock[stockItemIndex].qty;
      const minQty = localStock[stockItemIndex].minQty;
      
      if (newQty <= minQty) {
        setStockAlert(`Atenção: O estoque de ${localStock[stockItemIndex].name} está acabando! Restam apenas ${newQty} unidades.`);
        setTimeout(() => setStockAlert(null), 5000);
      }
      
      localStorage.setItem('rt_stock', JSON.stringify(localStock));

      // Tenta atualizar no Supabase (se for numérico)
      if (!isNaN(parseInt(realId))) {
        await supabase.from('Medication').update({ stock: newQty }).eq('id', realId);
      }
    }
  };

  const handleRefuseClick = (id) => {
    setRefusingId(id);
    setJustification('');
  };

  const confirmRefusal = () => {
    if (justification.trim() === '') {
      alert("A justificativa é obrigatória.");
      return;
    }
    setMeds(meds.map(m => m.id === refusingId ? { ...m, status: 'refused', justification } : m));
    setRefusingId(null);
  };

  const filteredMeds = meds.filter(m => m.time === currentTimeFilter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Check-list de Medicações</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="var(--primary)" />
          <select 
            className="textarea-huge" 
            style={{ minHeight: '40px', padding: '8px', fontSize: '1.1rem', width: 'auto' }}
            value={currentTimeFilter}
            onChange={(e) => setCurrentTimeFilter(e.target.value)}
          >
            {availableTimes.length === 0 && <option>Sem horários</option>}
            {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {stockAlert && (
        <div className="card" style={{ background: 'var(--danger-light)', borderLeft: '6px solid var(--danger)', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} color="var(--danger)" />
          <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.1rem' }}>{stockAlert}</span>
        </div>
      )}

      {filteredMeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Nenhuma medicação cadastrada ou agendada para este horário.</p>
      ) : (
        filteredMeds.map(med => (
          <div key={med.id} className="card" style={{ borderLeft: med.status === 'administered' ? '6px solid var(--secondary)' : med.status === 'refused' ? '6px solid var(--danger)' : '6px solid var(--warning)' }}>
          
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '4px' }}>{med.resident}</h3>
            <p style={{ fontSize: '1.2rem', color: 'var(--primary-dark)', fontWeight: '600' }}>
              <Pill size={20} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {med.name}
            </p>
          </div>

          {med.status === 'pending' && refusingId !== med.id && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-success" style={{ flex: 1, padding: '16px', fontSize: '1.1rem' }} onClick={() => handleAdminister(med.id, med.realId)}>
                <CheckCircle2 size={24} /> Dar Remédio
              </button>
              <button className="btn" style={{ flex: 1, padding: '16px', fontSize: '1.1rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '2px solid var(--danger)' }} onClick={() => handleRefuseClick(med.id)}>
                <XCircle size={24} /> Recusou
              </button>
            </div>
          )}

          {refusingId === med.id && (
            <div style={{ marginTop: '16px', background: 'var(--background)', padding: '16px', borderRadius: '12px' }}>
              <label className="input-label" style={{ fontSize: '1.1rem' }}>Por que recusou?</label>
              <textarea 
                className="textarea-huge" 
                style={{ minHeight: '80px', marginBottom: '12px', fontSize: '1.1rem' }}
                placeholder="Ex: Paciente dormindo ou agitado..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn" style={{ flex: 1, backgroundColor: 'white', border: '1px solid var(--border)' }} onClick={() => setRefusingId(null)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmRefusal}><Send size={20}/> Confirmar</button>
              </div>
            </div>
          )}

          {med.status === 'administered' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <CheckCircle2 size={24} /> Administrado com sucesso
            </div>
          )}

          {med.status === 'refused' && (
            <div style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '8px' }}>
                <XCircle size={24} /> Recusado pelo morador
              </div>
              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Motivo: {med.justification}</p>
            </div>
          )}
        </div>
        ))
      )}
    </div>
  );
}
