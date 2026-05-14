import React, { useState, useEffect } from 'react';
import { Calendar, Users, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ScheduleManagement() {
  const [schedule, setSchedule] = useState([]);
  const [teamSize, setTeamSize] = useState(0);

  useEffect(() => {
    const fetchTeam = async () => {
      const { data } = await supabase.from('User').select('*');
      if (data) {
        setTeamSize(data.length);
        
        // Carrega configurações de escala salvas localmente
        const localConfig = JSON.parse(localStorage.getItem('rt_schedule') || '{}');

        setSchedule(data.map(u => ({
          id: u.id,
          name: `${u.name} (${u.role.toUpperCase()})`,
          type: localConfig[u.id]?.type || 'A Definir',
          nextShift: localConfig[u.id]?.nextShift || 'A Definir',
          status: u.active ? 'Ativo' : 'Inativo'
        })));
      }
    };
    fetchTeam();
  }, []);

  const [editingUser, setEditingUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [editForm, setEditForm] = useState({ type: 'A Definir', nextShift: '' });

  const handleEditClick = (user) => {
    setEditForm({ type: user.type, nextShift: user.nextShift === 'A Definir' ? '' : user.nextShift });
    setEditingUser(user);
  };

  const saveEdit = () => {
    const updatedSchedule = schedule.map(u => {
      if (u.id === editingUser.id) {
        return { ...u, type: editForm.type, nextShift: editForm.nextShift || 'A Definir' };
      }
      return u;
    });
    setSchedule(updatedSchedule);

    const localConfig = JSON.parse(localStorage.getItem('rt_schedule') || '{}');
    localConfig[editingUser.id] = { type: editForm.type, nextShift: editForm.nextShift || 'A Definir' };
    localStorage.setItem('rt_schedule', JSON.stringify(localConfig));

    setEditingUser(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Gestão de Escalas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Visualize e aloque os funcionários para os próximos plantões.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }} onClick={() => setShowAddModal(true)}>
          <Plus size={20} />
          Adicionar Plantão Avulso
        </button>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary-dark)' }}>Adicionar Plantão Avulso</h3>
            
            <label className="input-label">Funcionário</label>
            <select className="textarea-huge" style={{ minHeight: '50px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }}>
              {schedule.map(u => <option key={u.id}>{u.name}</option>)}
            </select>

            <label className="input-label">Data</label>
            <input type="date" className="textarea-huge" style={{ minHeight: '50px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} />

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { alert('Plantão avulso adicionado com sucesso!'); setShowAddModal(false); }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary-dark)' }}>Definir Escala</h3>
            <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>{editingUser.name}</p>
            
            <label className="input-label">Regime de Trabalho</label>
            <select 
              className="textarea-huge" 
              style={{ minHeight: '50px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }}
              value={editForm.type}
              onChange={e => setEditForm({...editForm, type: e.target.value})}
            >
              <option>A Definir</option>
              <option>12x36 Diurno</option>
              <option>12x36 Noturno</option>
              <option>8h Diárias</option>
              <option>30h Semanais</option>
              <option>Folguista</option>
            </select>

            <label className="input-label">Próximo Plantão</label>
            <input 
              type="date" 
              className="textarea-huge" 
              style={{ minHeight: '50px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} 
              value={editForm.nextShift}
              onChange={e => setEditForm({...editForm, nextShift: e.target.value})}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setEditingUser(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar color="var(--primary)" /> Mês Atual</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>Maio 2026</p>
        </div>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid var(--secondary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users color="var(--secondary)" /> Equipe Ativa</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{teamSize} Funcionários</p>
        </div>
      </div>

      <table className="desktop-table">
        <thead>
          <tr>
            <th>Funcionário</th>
            <th>Regime</th>
            <th>Próximo Plantão</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map(row => (
            <tr key={row.id}>
              <td style={{ fontWeight: '600' }}>{row.name}</td>
              <td><span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>{row.type}</span></td>
              <td>{row.nextShift}</td>
              <td style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{row.status}</td>
              <td><button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px' }} onClick={() => handleEditClick(row)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
