import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, User, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Programmation({ role }) {
  const [events, setEvents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [residentId, setResidentId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchEvents();
    fetchResidents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase.from('Event').select('*').order('date', { ascending: true });
    if (data && data.length > 0) {
      setEvents(data);
    } else {
      const localEvents = JSON.parse(localStorage.getItem('rt_events') || '[]');
      // sort local events
      localEvents.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
      setEvents(localEvents);
    }
  };

  const fetchResidents = async () => {
    const { data } = await supabase.from('Resident').select('id, name');
    if (data) setResidents(data);
  };

  const handleSave = async () => {
    if (!title || !date || !time) {
      alert("Preencha pelo menos o título, a data e a hora.");
      return;
    }

    const selectedResident = residents.find(r => r.id === residentId);

    const newEvent = {
      id: Date.now().toString(),
      title,
      resident_id: residentId,
      resident_name: selectedResident ? selectedResident.name : 'Geral (Todos)',
      date,
      time,
      location,
      notes,
    };

    const { data, error } = await supabase.from('Event').insert([newEvent]).select();

    if (error) {
      const updated = [...events, newEvent].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
      setEvents(updated);
      localStorage.setItem('rt_events', JSON.stringify(updated));
    } else if (data) {
      fetchEvents();
    }

    setShowModal(false);
    setTitle(''); setResidentId(''); setDate(''); setTime(''); setLocation(''); setNotes('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deseja realmente excluir este compromisso?")) return;

    const { error } = await supabase.from('Event').delete().eq('id', id);
    if (error) {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated);
      localStorage.setItem('rt_events', JSON.stringify(updated));
    } else {
      fetchEvents();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ marginBottom: '4px', fontSize: '1.4rem' }}>Agenda / Programação</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Consultas e eventos dos moradores.
          </p>
        </div>
        {(role === 'admin' || role === 'enfermeiro') && (
          <button className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={() => setShowModal(true)}>
            <Plus size={20} />
            Novo Evento
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '80px' }}>
        {events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum compromisso agendado.</p>
        ) : (
          events.map(ev => {
            const evDate = new Date(`${ev.date}T00:00:00`).toLocaleDateString('pt-BR');
            return (
              <div key={ev.id} className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '12px 16px', marginBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', color: 'var(--text-main)' }}>{ev.title}</h3>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <User size={14} /> {ev.resident_name}
                    </p>
                    <p style={{ fontSize: '0.95rem', color: 'var(--primary-dark)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <CalendarIcon size={14} /> {evDate} <Clock size={14} style={{ marginLeft: '8px' }} /> {ev.time}
                    </p>
                    {ev.location && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        <MapPin size={14} /> {ev.location}
                      </p>
                    )}
                    {ev.notes && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        <strong>Obs:</strong> {ev.notes}
                      </div>
                    )}
                  </div>

                  {(role === 'admin' || role === 'enfermeiro') && (
                    <button 
                      className="btn" 
                      style={{ background: 'transparent', color: 'var(--danger)', padding: '6px', border: '1px solid var(--border)' }}
                      onClick={() => handleDelete(ev.id)}
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '32px', margin: '40px 0' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '20px', color: 'var(--primary-dark)' }}>Agendar Novo Evento</h3>
            
            <label className="input-label">Título (Ex: Consulta Dr. João) *</label>
            <input type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box', marginBottom: '16px' }} value={title} onChange={e => setTitle(e.target.value)} />

            <label className="input-label">Morador Relacionado</label>
            <select className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box', marginBottom: '16px' }} value={residentId} onChange={e => setResidentId(e.target.value)}>
              <option value="">Geral (Todos ou Nenhum específico)</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label className="input-label">Data *</label>
                <input type="date" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Hora *</label>
                <input type="time" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            <label className="input-label">Local (Opcional)</label>
            <input type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box', marginBottom: '16px' }} placeholder="Ex: Hospital Unimed" value={location} onChange={e => setLocation(e.target.value)} />

            <label className="input-label">Observações (Opcional)</label>
            <textarea className="textarea-huge" style={{ minHeight: '80px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box', marginBottom: '24px' }} placeholder="Ex: Precisa estar em jejum..." value={notes} onChange={e => setNotes(e.target.value)} />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Agendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
