import React, { useState, useEffect } from 'react';
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
    if (timesArray.length > 0 && !currentTimeFilter) {
      // Opcionalmente podemos selecionar o primeiro, ou exibir todos
      setCurrentTimeFilter('Todos');
    }

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

  const filteredMeds = currentTimeFilter === 'Todos' || !currentTimeFilter 
    ? meds 
    : meds.filter(m => m.time === currentTimeFilter);

  // Agrupa os medicamentos filtrados por morador
  const groupedMeds = filteredMeds.reduce((acc, med) => {
    if (!acc[med.resident]) acc[med.resident] = [];
    acc[med.resident].push(med);
    return acc;
  }, {});

  // Ordena os medicamentos de cada morador por horário
  Object.keys(groupedMeds).forEach(res => {
    groupedMeds[res].sort((a, b) => a.time.localeCompare(b.time));
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.4rem' }}>Check-list Medicações</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color="var(--primary)" />
          <select 
            className="textarea-huge" 
            style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.95rem', width: 'auto' }}
            value={currentTimeFilter}
            onChange={(e) => setCurrentTimeFilter(e.target.value)}
          >
            <option value="Todos">Todos os horários</option>
            {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {stockAlert && (
        <div className="card" style={{ background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} color="var(--danger)" />
          <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.95rem' }}>{stockAlert}</span>
        </div>
      )}

      {Object.keys(groupedMeds).length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Nenhuma medicação encontrada para o filtro selecionado.</p>
      ) : (
        Object.keys(groupedMeds).map(residentName => (
          <div key={residentName} className="card" style={{ padding: '0', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)', margin: 0 }}>{residentName}</h3>
            </div>
            
            <div style={{ padding: '12px 16px' }}>
              {groupedMeds[residentName].map((med, idx) => (
                <div key={med.id} style={{ 
                  paddingBottom: idx === groupedMeds[residentName].length - 1 ? '0' : '12px', 
                  marginBottom: idx === groupedMeds[residentName].length - 1 ? '0' : '12px', 
                  borderBottom: idx === groupedMeds[residentName].length - 1 ? 'none' : '1px solid var(--border)' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} color="var(--primary)" /> {med.time}
                        </p>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <Pill size={14} /> {med.name}
                        </p>
                      </div>

                      {med.status === 'administered' && (
                        <span style={{ color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={16} /> Concluído
                        </span>
                      )}

                      {med.status === 'refused' && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={16} /> Recusado
                        </span>
                      )}
                    </div>

                    {med.status === 'pending' && refusingId !== med.id && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button className="btn btn-success" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={() => handleAdminister(med.id, med.realId)}>
                          <CheckCircle2 size={16} /> Dar Remédio
                        </button>
                        <button className="btn" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={() => handleRefuseClick(med.id)}>
                          <XCircle size={16} /> Recusou
                        </button>
                      </div>
                    )}
                    
                    {refusingId === med.id && (
                      <div style={{ marginTop: '8px', background: 'var(--background)', padding: '12px', borderRadius: '8px' }}>
                        <textarea 
                          className="textarea-huge" 
                          style={{ minHeight: '60px', marginBottom: '8px', fontSize: '0.9rem', padding: '8px' }}
                          placeholder="Motivo da recusa..."
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', backgroundColor: 'white', border: '1px solid var(--border)' }} onClick={() => setRefusingId(null)}>Cancelar</button>
                          <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={confirmRefusal}><Send size={16}/> Confirmar</button>
                        </div>
                      </div>
                    )}

                    {med.status === 'refused' && (
                      <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Motivo: {med.justification}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
