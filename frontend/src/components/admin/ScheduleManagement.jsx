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
        setSchedule(data.map(u => ({
          id: u.id,
          name: `${u.name} (${u.role})`,
          type: 'A Definir',
          nextShift: 'A Definir',
          status: 'Ativo'
        })));
      }
    };
    fetchTeam();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Gestão de Escalas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Visualize e aloque os funcionários para os próximos plantões.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }}>
          <Plus size={20} />
          Adicionar Plantão
        </button>
      </div>

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
              <td><button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px' }}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
