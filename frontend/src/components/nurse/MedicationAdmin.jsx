import React, { useState } from 'react';
import { Pill, CheckCircle2, XCircle, Send } from 'lucide-react';

export default function MedicationAdmin() {
  const [meds, setMeds] = useState([]);

  const [refusingId, setRefusingId] = useState(null);
  const [justification, setJustification] = useState('');

  const handleAdminister = (id) => {
    setMeds(meds.map(m => m.id === id ? { ...m, status: 'administered' } : m));
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

  return (
    <div>
      <h2>Medicações do Horário (14:00)</h2>

      {meds.map(med => (
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
              <button className="btn btn-success" style={{ flex: 1, padding: '16px', fontSize: '1.1rem' }} onClick={() => handleAdminister(med.id)}>
                <CheckCircle2 size={24} /> Dar
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
      ))}
    </div>
  );
}
