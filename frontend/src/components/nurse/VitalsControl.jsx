import React, { useState, useEffect } from 'react';
import { Activity, Heart, Droplets, Thermometer, Wind, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function VitalsControl() {
  const [selectedResident, setSelectedResident] = useState(null);
  const [saved, setSaved] = useState(false);
  const [vitals, setVitals] = useState({
    bp: '', glucose: '', temp: '', spo2: '', notes: ''
  });
  const [residents, setResidents] = useState([]);
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    // Attempt to fetch from a generic 'VitalSigns' table
    const { data } = await supabase.from('VitalSigns').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setHistory(data);
  };

  useEffect(() => {
    const fetchResidents = async () => {
      const { data } = await supabase.from('Resident').select('*');
      if (data) {
        setResidents(data);
      }
    };
    fetchResidents();
    fetchHistory();
  }, []);

  const handleSave = async () => {
    // Save to Supabase
    const { error } = await supabase.from('VitalSigns').insert([{
      resident_id: selectedResident.id,
      resident_name: selectedResident.name,
      bp: vitals.bp,
      glucose: vitals.glucose,
      temp: vitals.temp,
      spo2: vitals.spo2,
      notes: vitals.notes,
      created_at: new Date().toISOString()
    }]);

    if (!error) {
      fetchHistory();
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSelectedResident(null);
        setVitals({ bp: '', glucose: '', temp: '', spo2: '', notes: '' });
      }, 2000);
    } else {
      alert("Erro ao salvar sinais: " + error.message);
    }
  };

  if (saved) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <CheckCircle size={80} color="var(--secondary)" style={{ margin: '0 auto 20px' }} />
        <h2>Sinais Salvos!</h2>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Histórico de {selectedResident?.name} atualizado com sucesso.</p>
      </div>
    );
  }

  if (!selectedResident) {
    return (
      <div>
        <h2 style={{ marginBottom: '16px' }}>Aferir Sinais Vitais</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {residents.map(res => (
            <div key={res.id} onClick={() => setSelectedResident(res)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '2px' }}>{res.name}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Última aferição: Normal</span>
              </div>
              <Activity color="var(--primary)" size={20} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', marginBottom: '80px' }}>
          <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--primary-dark)' }}>
            Últimas Aferições
          </h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma aferição recente.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {history.map(record => (
                <div key={record.id} className="card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                      {record.resident_name || 'Paciente'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {record.created_at ? new Date(record.created_at).toLocaleString('pt-BR') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <div><strong>PA:</strong> {record.bp || '-'}</div>
                    <div><strong>Glicemia:</strong> {record.glucose || '-'}</div>
                    <div><strong>Temp:</strong> {record.temp || '-'}</div>
                    <div><strong>SpO2:</strong> {record.spo2 || '-'}</div>
                  </div>
                  {record.notes && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <strong>Obs:</strong> {record.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Sinais: {selectedResident.name}</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setSelectedResident(null)}>Voltar</button>
      </div>

      <div className="card">
        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={20} color="var(--danger)" /> Pressão Arterial (mmHg)
        </label>
        <input 
          type="text" 
          placeholder="Ex: 120/80" 
          className="textarea-huge" 
          style={{ minHeight: '60px', height: '60px', marginBottom: '16px' }}
          value={vitals.bp} onChange={(e) => setVitals({...vitals, bp: e.target.value})}
        />

        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Droplets size={20} color="var(--info)" /> Glicemia (mg/dL)
        </label>
        <input 
          type="number" 
          placeholder="Ex: 99" 
          className="textarea-huge" 
          style={{ minHeight: '60px', height: '60px', marginBottom: '16px' }}
          value={vitals.glucose} onChange={(e) => setVitals({...vitals, glucose: e.target.value})}
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
              <Thermometer size={18} color="var(--warning)" /> Temp. (°C)
            </label>
            <input type="number" placeholder="36.5" className="textarea-huge" style={{ minHeight: '60px', height: '60px', marginBottom: '16px' }} value={vitals.temp} onChange={(e) => setVitals({...vitals, temp: e.target.value})} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
              <Wind size={18} color="var(--primary)" /> SpO2 (%)
            </label>
            <input type="number" placeholder="98" className="textarea-huge" style={{ minHeight: '60px', height: '60px', marginBottom: '16px' }} value={vitals.spo2} onChange={(e) => setVitals({...vitals, spo2: e.target.value})} />
          </div>
        </div>

        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          Anotações / Observações (Opcional)
        </label>
        <textarea 
          placeholder="Alguma observação importante sobre o paciente?" 
          className="textarea-huge" 
          style={{ minHeight: '80px', marginBottom: '24px', padding: '12px', fontSize: '1rem' }}
          value={vitals.notes} onChange={(e) => setVitals({...vitals, notes: e.target.value})} 
        />

        <button className="btn-massive btn-primary" onClick={handleSave}>
          <Save size={28} />
          Salvar Sinais
        </button>
      </div>
    </div>
  );
}
