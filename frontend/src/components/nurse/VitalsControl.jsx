import React, { useState, useEffect } from 'react';
import { Activity, Heart, Droplets, Thermometer, Wind, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function VitalsControl() {
  const [selectedResident, setSelectedResident] = useState(null);
  const [saved, setSaved] = useState(false);
  const [vitals, setVitals] = useState({
    bp: '', glucose: '', temp: '', spo2: ''
  });
  const [residents, setResidents] = useState([]);

  useEffect(() => {
    const fetchResidents = async () => {
      const { data } = await supabase.from('Resident').select('*');
      if (data) {
        setResidents(data);
      }
    };
    fetchResidents();
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSelectedResident(null);
      setVitals({ bp: '', glucose: '', temp: '', spo2: '' });
    }, 2000);
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
        <h2>Aferir Sinais Vitais</h2>
        {residents.map(res => (
          <div key={res.id} className="card" onClick={() => setSelectedResident(res)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{res.name}</h3>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Última aferição: Normal</span>
            </div>
            <Activity color="var(--primary)" />
          </div>
        ))}
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

        <button className="btn-massive btn-primary" onClick={handleSave}>
          <Save size={28} />
          Salvar Sinais
        </button>
      </div>
    </div>
  );
}
