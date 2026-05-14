import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Edit2, Save, UserPlus, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AccessManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({ name: '', cpf: '', email: '', password: '', role: 'CUIDADOR' });

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('User').select('*').order('name');
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    if (editingId) {
      const { error } = await supabase.from('User').update({ ...formData, updatedAt: new Date().toISOString() }).eq('id', editingId);
      if (!error) {
        handleSuccess();
        setFormData({ name: '', cpf: '', email: '', password: '', role: 'CUIDADOR' });
        setEditingId(null);
        fetchUsers();
      } else alert(error.message);
    } else {
      const { error } = await supabase.from('User').insert([{ id: crypto.randomUUID(), ...formData, updatedAt: new Date().toISOString() }]);
      if (!error) {
        handleSuccess();
        setFormData({ name: '', cpf: '', email: '', password: '', role: 'CUIDADOR' });
        fetchUsers();
      } else alert(error.message);
    }
    setSaving(false);
  };

  const deleteUser = async (u) => {
    if (u.role === 'DIRETOR') {
      alert('Contas de Diretor Geral são blindadas e não podem ser excluídas por segurança.');
      return;
    }

    if (window.confirm('Tem certeza que deseja remover o acesso deste usuário?')) {
      await supabase.from('User').delete().eq('id', u.id);
      fetchUsers();
    }
  };

  const editUser = (u) => {
    if (u.role === 'DIRETOR' && currentUser?.role !== 'DIRETOR') {
      alert('Contas de Diretor são blindadas. Apenas o próprio Diretor pode editar seus dados.');
      return;
    }
    setEditingId(u.id);
    setFormData({ name: u.name, cpf: u.cpf || '', email: u.email, password: u.password, role: u.role });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', cpf: '', email: '', password: '', role: 'CUIDADOR' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Gestão de Acessos e Equipe</h2>
          <p style={{ color: 'var(--text-muted)' }}>Cadastre novos funcionários e gerencie as permissões.</p>
        </div>
      </div>

      {success && (
        <div style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <CheckCircle2 /> {editingId ? 'Usuário atualizado com sucesso!' : 'Novo usuário cadastrado com sucesso!'}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* Form Column */}
        <div className="card" style={{ flex: '1', minWidth: '100%', maxWidth: '400px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {editingId ? <Edit2 size={20} /> : <UserPlus size={20} />} 
            {editingId ? 'Editar Usuário' : 'Novo Membro da Equipe'}
          </h3>
          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }}/>
          
          <form onSubmit={handleSave}>
            <label className="input-label">Nome Completo</label>
            <input required className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />

            <label className="input-label">CPF</label>
            <input required placeholder="000.000.000-00" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />

            <label className="input-label">Email (Login)</label>
            <input required type="email" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />

            <label className="input-label">Cargo / Permissão</label>
            <select className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="CUIDADOR">Cuidador(a) - Acesso Básico</option>
              <option value="ENFERMEIRO">Téc. Enfermagem - Acesso Clínico</option>
              <option value="ADMIN">Supervisora - Acesso Total (Admin)</option>
              <option value="DIRETOR">Diretor Geral - Blindado</option>
            </select>

            <label className="input-label">Senha</label>
            <input required type="text" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '24px' }} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />

            <div style={{ display: 'flex', gap: '12px' }}>
              {editingId && (
                <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={cancelEdit}>Cancelar</button>
              )}
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2, padding: '12px' }}>
                <Save size={20} /> {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>

        {/* Table Column */}
        <div className="card" style={{ flex: '2', padding: '0', overflowX: 'auto', minWidth: '100%' }}>
          <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '16px' }}>Nome & CPF</th>
                <th style={{ padding: '16px' }}>Login e Cargo</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center' }}>Carregando usuários...</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: editingId === u.id ? 'var(--background)' : 'transparent' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>CPF: {u.cpf || 'Não cadastrado'}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{u.email}</div>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold',
                        backgroundColor: (u.role === 'ADMIN' || u.role === 'DIRETOR') ? 'var(--danger-light)' : u.role === 'ENFERMEIRO' ? 'var(--info-light)' : 'var(--primary-light)',
                        color: (u.role === 'ADMIN' || u.role === 'DIRETOR') ? 'var(--danger)' : u.role === 'ENFERMEIRO' ? 'var(--info)' : 'var(--primary-dark)'
                      }}>
                        {u.role === 'DIRETOR' ? 'Diretor Geral' : u.role === 'ADMIN' ? 'Supervisora' : u.role === 'ENFERMEIRO' ? 'Téc. Enfermagem' : 'Cuidador'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--primary)', marginRight: '8px' }} onClick={() => editUser(u)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--danger)', opacity: u.role === 'DIRETOR' ? 0.3 : 1, cursor: u.role === 'DIRETOR' ? 'not-allowed' : 'pointer' }} onClick={() => deleteUser(u)} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
