import React, { useState, useEffect } from 'react';
import { Pill, Apple, Users, Save, CheckCircle2, Trash2, Edit2, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const formatDate = (isoString) => {
  if (!isoString) return '';
  return isoString.split('T')[0].split('-').reverse().join('/');
};

export default function DataRegistration() {
  const [activeTab, setActiveTab] = useState('moradores');
  
  // Data lists
  const [residents, setResidents] = useState([]);
  const [meds, setMeds] = useState([]);
  const [foods, setFoods] = useState([]);
  
  // Loaders
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Edit States
  const [editingId, setEditingId] = useState(null);

  // Forms
  const [resident, setResident] = useState({ name: '', cpf: '', dateOfBirth: '', allergies: '' });
  const [med, setMed] = useState({ name: '', dosage: '', minStock: '' });
  const [food, setFood] = useState({ name: '', category: 'Básico', unit: 'unidades', quantity: '', minQuantity: '' });

  const fetchData = async () => {
    setLoadingList(true);
    if (activeTab === 'moradores') {
      const { data } = await supabase.from('Resident').select('*').order('name');
      setResidents(data || []);
    } else if (activeTab === 'medicamentos') {
      const { data } = await supabase.from('Medication').select('*').order('name');
      setMeds(data || []);
    } else if (activeTab === 'despensa') {
      const { data } = await supabase.from('FoodItem').select('*').order('name');
      setFoods(data || []);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    fetchData();
    cancelEdit();
  }, [activeTab]);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const cancelEdit = () => {
    setEditingId(null);
    if (activeTab === 'moradores') setResident({ name: '', cpf: '', dateOfBirth: '', allergies: '' });
    else if (activeTab === 'medicamentos') setMed({ name: '', dosage: '', minStock: '' });
    else if (activeTab === 'despensa') setFood({ name: '', category: 'Básico', unit: 'unidades', quantity: '', minQuantity: '' });
  };

  // ----- CRUD MORADORES -----
  const saveResident = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    let formattedDate = resident.dateOfBirth;
    if (formattedDate && !formattedDate.includes('T')) {
      formattedDate = new Date(formattedDate).toISOString();
    }

    if (editingId) {
      const { error } = await supabase.from('Resident').update({ ...resident, dateOfBirth: formattedDate, updatedAt: new Date().toISOString() }).eq('id', editingId);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    } else {
      const { error } = await supabase.from('Resident').insert([{ id: crypto.randomUUID(), ...resident, dateOfBirth: formattedDate, updatedAt: new Date().toISOString() }]);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    }
    setSaving(false);
  };

  const editResident = (r) => {
    setEditingId(r.id);
    setResident({
      name: r.name,
      cpf: r.cpf || '',
      dateOfBirth: r.dateOfBirth ? r.dateOfBirth.split('T')[0] : '',
      allergies: r.allergies || ''
    });
  };

  const deleteResident = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este morador?')) {
      await supabase.from('Resident').delete().eq('id', id);
      fetchData();
    }
  };

  // ----- CRUD MEDICAMENTOS -----
  const saveMed = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('Medication').update({ ...med, minStock: parseInt(med.minStock), updatedAt: new Date().toISOString() }).eq('id', editingId);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    } else {
      const { error } = await supabase.from('Medication').insert([{ id: crypto.randomUUID(), ...med, minStock: parseInt(med.minStock), stock: 0, updatedAt: new Date().toISOString() }]);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    }
    setSaving(false);
  };

  const editMed = (m) => {
    setEditingId(m.id);
    setMed({ name: m.name, dosage: m.dosage, minStock: m.minStock });
  };

  const deleteMed = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este medicamento?')) {
      await supabase.from('Medication').delete().eq('id', id);
      fetchData();
    }
  };

  // ----- CRUD DESPENSA -----
  const saveFood = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('FoodItem').update({ ...food, quantity: parseFloat(food.quantity), minQuantity: parseFloat(food.minQuantity), updatedAt: new Date().toISOString() }).eq('id', editingId);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    } else {
      const { error } = await supabase.from('FoodItem').insert([{ id: crypto.randomUUID(), ...food, quantity: parseFloat(food.quantity), minQuantity: parseFloat(food.minQuantity), updatedAt: new Date().toISOString() }]);
      if (!error) { handleSuccess(); cancelEdit(); fetchData(); } else alert(error.message);
    }
    setSaving(false);
  };

  const editFood = (f) => {
    setEditingId(f.id);
    setFood({ name: f.name, category: f.category, unit: f.unit, quantity: f.quantity, minQuantity: f.minQuantity });
  };

  const deleteFood = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este item da despensa?')) {
      await supabase.from('FoodItem').delete().eq('id', id);
      fetchData();
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '4px' }}>Central de Cadastros e Gestão</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Gerencie moradores, medicamentos e itens de despensa.</p>
      </div>

      {/* Tabs de Seleção */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <button className={`btn ${activeTab === 'moradores' ? 'btn-primary' : ''}`} style={{ background: activeTab !== 'moradores' ? 'white' : '', border: '1px solid var(--border)' }} onClick={() => setActiveTab('moradores')}>
          <Users size={20}/> Moradores
        </button>
        <button className={`btn ${activeTab === 'medicamentos' ? 'btn-primary' : ''}`} style={{ background: activeTab !== 'medicamentos' ? 'white' : '', border: '1px solid var(--border)' }} onClick={() => setActiveTab('medicamentos')}>
          <Pill size={20}/> Medicamentos
        </button>
        <button className={`btn ${activeTab === 'despensa' ? 'btn-primary' : ''}`} style={{ background: activeTab !== 'despensa' ? 'white' : '', border: '1px solid var(--border)' }} onClick={() => setActiveTab('despensa')}>
          <Apple size={20}/> Despensa
        </button>
      </div>

      {success && (
        <div style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <CheckCircle2 /> {editingId ? 'Registro atualizado com sucesso!' : 'Novo registro salvo com sucesso!'}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* COLUNA ESQUERDA: FORMULÁRIOS */}
        <div className="card" style={{ flex: '1', minWidth: '100%', maxWidth: '400px' }}>
          
          {/* Formulário: MORADORES */}
          {activeTab === 'moradores' && (
            <form onSubmit={saveResident}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {editingId ? <Edit2 size={20} /> : <PlusCircle size={20} />} 
                {editingId ? 'Editar Morador' : 'Novo Morador'}
              </h3>
              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }}/>
              
              <label className="input-label">Nome Completo</label>
              <input required className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={resident.name} onChange={e => setResident({...resident, name: e.target.value})} />

              <label className="input-label">CPF</label>
              <input required placeholder="000.000.000-00" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={resident.cpf} onChange={e => setResident({...resident, cpf: e.target.value})} />

              <label className="input-label">Data de Nascimento</label>
              <input required type="date" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={resident.dateOfBirth} onChange={e => setResident({...resident, dateOfBirth: e.target.value})} />

              <label className="input-label">Alergias (Opcional)</label>
              <input className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '24px' }} value={resident.allergies} onChange={e => setResident({...resident, allergies: e.target.value})} />

              <div style={{ display: 'flex', gap: '12px' }}>
                {editingId && <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={cancelEdit}>Cancelar</button>}
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2, padding: '12px' }}>
                  <Save size={20} /> {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

          {/* Formulário: MEDICAMENTOS */}
          {activeTab === 'medicamentos' && (
            <form onSubmit={saveMed}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {editingId ? <Edit2 size={20} /> : <PlusCircle size={20} />} 
                {editingId ? 'Editar Medicamento' : 'Novo Medicamento'}
              </h3>
              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }}/>
              
              <label className="input-label">Nome do Remédio</label>
              <input required placeholder="Ex: Losartana" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={med.name} onChange={e => setMed({...med, name: e.target.value})} />

              <label className="input-label">Apresentação / Dosagem</label>
              <input required placeholder="Ex: 50mg comprimido" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={med.dosage} onChange={e => setMed({...med, dosage: e.target.value})} />

              <label className="input-label">Estoque Mínimo (Alerta)</label>
              <input required type="number" placeholder="Ex: 20" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '24px' }} value={med.minStock} onChange={e => setMed({...med, minStock: e.target.value})} />

              <div style={{ display: 'flex', gap: '12px' }}>
                {editingId && <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={cancelEdit}>Cancelar</button>}
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2, padding: '12px' }}>
                  <Save size={20} /> {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

          {/* Formulário: DESPENSA */}
          {activeTab === 'despensa' && (
            <form onSubmit={saveFood}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {editingId ? <Edit2 size={20} /> : <PlusCircle size={20} />} 
                {editingId ? 'Editar Item' : 'Novo Item'}
              </h3>
              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }}/>
              
              <label className="input-label">Nome do Item</label>
              <input required placeholder="Ex: Arroz Tipo 1" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={food.name} onChange={e => setFood({...food, name: e.target.value})} />

              <label className="input-label">Categoria</label>
              <select className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={food.category} onChange={e => setFood({...food, category: e.target.value})}>
                <option>Básico</option>
                <option>Limpeza</option>
                <option>Higiene</option>
                <option>Verduras</option>
                <option>Proteínas</option>
                <option>Moradores</option>
              </select>

              <label className="input-label">Unidade de Medida</label>
              <select className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', marginBottom: '16px' }} value={food.unit} onChange={e => setFood({...food, unit: e.target.value})}>
                <option>unidades</option>
                <option>kg</option>
                <option>litros</option>
                <option>pacotes</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label className="input-label">Estoque Atual</label>
                  <input required type="number" placeholder="Ex: 10" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={food.quantity} onChange={e => setFood({...food, quantity: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Estoque Mínimo</label>
                  <input required type="number" placeholder="Ex: 5" className="textarea-huge" style={{ minHeight: '40px', padding: '12px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} value={food.minQuantity} onChange={e => setFood({...food, minQuantity: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {editingId && <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={cancelEdit}>Cancelar</button>}
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2, padding: '12px' }}>
                  <Save size={20} /> {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* COLUNA DIREITA: TABELAS */}
        <div className="card" style={{ flex: '2', padding: '0', overflowX: 'auto', minWidth: '100%' }}>
          
          {/* Tabela: MORADORES */}
          {activeTab === 'moradores' && (
            <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px' }}>Nome</th>
                  <th style={{ padding: '16px' }}>CPF</th>
                  <th style={{ padding: '16px' }}>Nascimento</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Carregando...</td></tr> : 
                  residents.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: editingId === r.id ? 'var(--background)' : '' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{r.name}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{r.cpf || '-'}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{formatDate(r.dateOfBirth)}</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--primary)', marginRight: '8px' }} onClick={() => editResident(r)}><Edit2 size={18}/></button>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--danger)' }} onClick={() => deleteResident(r.id)}><Trash2 size={18}/></button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Tabela: MEDICAMENTOS */}
          {activeTab === 'medicamentos' && (
            <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px' }}>Remédio</th>
                  <th style={{ padding: '16px' }}>Dosagem</th>
                  <th style={{ padding: '16px' }}>Estoque Mínimo</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Carregando...</td></tr> : 
                  meds.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', background: editingId === m.id ? 'var(--background)' : '' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{m.name}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{m.dosage}</td>
                      <td style={{ padding: '16px', color: 'var(--warning)' }}>{m.minStock}</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--primary)', marginRight: '8px' }} onClick={() => editMed(m)}><Edit2 size={18}/></button>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--danger)' }} onClick={() => deleteMed(m.id)}><Trash2 size={18}/></button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Tabela: DESPENSA */}
          {activeTab === 'despensa' && (
            <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px' }}>Item</th>
                  <th style={{ padding: '16px' }}>Categoria</th>
                  <th style={{ padding: '16px' }}>Estoque Atual</th>
                  <th style={{ padding: '16px' }}>Mínimo p/ Alerta</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Carregando...</td></tr> : 
                  foods.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border)', background: editingId === f.id ? 'var(--background)' : '' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{f.name}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', background: 'var(--background)' }}>
                          {f.category}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--primary-dark)', fontWeight: 'bold' }}>{f.quantity} {f.unit}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{f.minQuantity} {f.unit}</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--primary)', marginRight: '8px' }} onClick={() => editFood(f)}><Edit2 size={18}/></button>
                        <button className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--danger)' }} onClick={() => deleteFood(f.id)}><Trash2 size={18}/></button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>
    </div>
  );
}
