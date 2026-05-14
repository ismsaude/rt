import React, { useState } from 'react';
import { 
  CheckSquare, Utensils, ClipboardEdit, 
  Activity, Pill, PackageOpen, UserCircle,
  CalendarDays, ShoppingCart, FileText, Database, Shield, LogOut, Key
} from 'lucide-react';
import { supabase } from './lib/supabase';

import Login from './components/Login';

// Cuidador Components
import Dashboard from './components/Dashboard';
import ShiftHandover from './components/ShiftHandover';
import DailyMenu from './components/DailyMenu';

// Enfermeiro Components
import VitalsControl from './components/nurse/VitalsControl';
import MedicationAdmin from './components/nurse/MedicationAdmin';
import PharmacyStock from './components/nurse/PharmacyStock';

// Admin Components
import ScheduleManagement from './components/admin/ScheduleManagement';
import InventoryManagement from './components/admin/InventoryManagement';
import ResidentReports from './components/admin/ResidentReports';
import DataRegistration from './components/admin/DataRegistration';
import AccessManagement from './components/admin/AccessManagement';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState('admin');
  const [activeTab, setActiveTab] = useState('cadastros');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const handleLogin = (userRole, user) => {
    setRole(userRole);
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    if (userRole === 'admin') setActiveTab('cadastros');
    else if (userRole === 'enfermeiro') setActiveTab('sinais');
    else setActiveTab('tarefas');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      setPasswordMsg('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    
    const { error } = await supabase.from('User').update({ password: newPassword }).eq('id', currentUser.id);
    if (!error) {
      setPasswordMsg('Senha alterada com sucesso!');
      setTimeout(() => {
        setShowPasswordModal(false);
        setNewPassword('');
        setPasswordMsg('');
      }, 2000);
    } else {
      setPasswordMsg('Erro ao alterar senha.');
    }
  };

  const renderContent = () => {
    if (role === 'cuidador') {
      switch (activeTab) {
        case 'tarefas': return <Dashboard />;
        case 'cardapio': return <DailyMenu />;
        case 'plantao': return <ShiftHandover currentUser={currentUser} />;
        default: return <Dashboard />;
      }
    } else if (role === 'enfermeiro') {
      switch (activeTab) {
        case 'sinais': return <VitalsControl />;
        case 'medicacoes': return <MedicationAdmin />;
        case 'estoque': return <PharmacyStock />;
        default: return <VitalsControl />;
      }
    } else {
      switch (activeTab) {
        case 'escalas': return <ScheduleManagement />;
        case 'estoque_admin': return <InventoryManagement />;
        case 'relatorios': return <ResidentReports currentUser={currentUser} />;
        case 'cadastros': return <DataRegistration />;
        case 'acessos': return <AccessManagement currentUser={currentUser} />;
        // Cuidador tabs
        case 'tarefas': return <Dashboard />;
        case 'cardapio': return <DailyMenu />;
        case 'plantao': return <ShiftHandover currentUser={currentUser} />;
        // Enfermeiro tabs
        case 'sinais': return <VitalsControl />;
        case 'medicacoes': return <MedicationAdmin />;
        case 'estoque': return <PharmacyStock />;
        default: return <DataRegistration />;
      }
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // ADMIN LAYOUT (Desktop Focus)
  if (role === 'admin') {
    return (
      <div className="admin-container">
        <aside className="sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }} className="sidebar-header-mobile">
            <div className="sidebar-title" style={{ marginBottom: 0 }}>Aurean Residência Terapêutica - Porto Feliz/SP</div>
            <button className="btn btn-danger mobile-logout-only" style={{ padding: '8px', display: 'none' }} onClick={handleLogout}>
              <LogOut size={20} />
            </button>
          </div>
          
          <nav className="sidebar-menu">
            <div style={{ marginBottom: '10px', fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Administração</div>
            <a className={`sidebar-link ${activeTab === 'cadastros' ? 'active' : ''}`} onClick={() => setActiveTab('cadastros')}>
              <Database size={20} /> Central de Cadastros
            </a>
            <a className={`sidebar-link ${activeTab === 'escalas' ? 'active' : ''}`} onClick={() => setActiveTab('escalas')}>
              <CalendarDays size={20} /> Gestão de Escalas
            </a>
            <a className={`sidebar-link ${activeTab === 'estoque_admin' ? 'active' : ''}`} onClick={() => setActiveTab('estoque_admin')}>
              <ShoppingCart size={20} /> Estoque e Compras
            </a>
            <a className={`sidebar-link ${activeTab === 'relatorios' ? 'active' : ''}`} onClick={() => setActiveTab('relatorios')}>
              <FileText size={20} /> Relatórios
            </a>
            <a className={`sidebar-link ${activeTab === 'acessos' ? 'active' : ''}`} onClick={() => setActiveTab('acessos')}>
              <Shield size={20} /> Gestão de Acessos
            </a>

            <div style={{ marginTop: '20px', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operacional - Cuidador</div>
            <a className={`sidebar-link ${activeTab === 'tarefas' ? 'active' : ''}`} onClick={() => setActiveTab('tarefas')}>
              <CheckSquare size={20} /> Tarefas
            </a>
            <a className={`sidebar-link ${activeTab === 'cardapio' ? 'active' : ''}`} onClick={() => setActiveTab('cardapio')}>
              <Utensils size={20} /> Cardápio
            </a>
            <a className={`sidebar-link ${activeTab === 'plantao' ? 'active' : ''}`} onClick={() => setActiveTab('plantao')}>
              <ClipboardEdit size={20} /> Plantão
            </a>

            <div style={{ marginTop: '20px', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operacional - Enfermagem</div>
            <a className={`sidebar-link ${activeTab === 'sinais' ? 'active' : ''}`} onClick={() => setActiveTab('sinais')}>
              <Activity size={20} /> Sinais Vitais
            </a>
            <a className={`sidebar-link ${activeTab === 'medicacoes' ? 'active' : ''}`} onClick={() => setActiveTab('medicacoes')}>
              <Pill size={20} /> Medicação
            </a>
            <a className={`sidebar-link ${activeTab === 'estoque' ? 'active' : ''}`} onClick={() => setActiveTab('estoque')}>
              <PackageOpen size={20} /> Estoque Enfermagem
            </a>
          </nav>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '20px' }} className="desktop-logout-only">
            <button className="btn" style={{ width: '100%', background: 'var(--danger-light)', color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={20} /> Sair do Sistema
            </button>
          </div>
        </aside>
        
        <main className="admin-content">
          {renderContent()}
        </main>
      </div>
    );
  }

  // MOBILE LAYOUT (Cuidador & Enfermeiro)
  return (
    <div className="mobile-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Aurean Residência Terapêutica</h1>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
            Olá, {currentUser?.name?.split(' ')[0] || 'Equipe'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setShowPasswordModal(true)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Key size={24} />
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Senha</span>
          </button>
          
          <button 
            onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <LogOut size={24} />
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Sair</span>
          </button>
        </div>
      </header>

      {/* MODAL TROCAR SENHA */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '360px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary-dark)' }}>Mudar Minha Senha</h3>
            
            <label className="input-label">Nova Senha</label>
            <input 
              type="password" 
              className="textarea-huge" 
              style={{ minHeight: '50px', padding: '12px', fontSize: '1.2rem', marginBottom: '8px' }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha..."
            />
            
            {passwordMsg && <p style={{ color: passwordMsg.includes('sucesso') ? 'var(--secondary)' : 'var(--danger)', fontSize: '0.9rem', marginBottom: '16px', fontWeight: 'bold' }}>{passwordMsg}</p>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowPasswordModal(false)}>Fechar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePasswordChange}>Salvar Senha</button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        {renderContent()}
      </main>

      {/* Navegação condicional baseada no perfil */}
      {role === 'cuidador' ? (
        <nav className="bottom-nav">
          <a href="#" className={`nav-item ${activeTab === 'tarefas' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('tarefas'); }}>
            <CheckSquare /><span>Tarefas</span>
          </a>
          <a href="#" className={`nav-item ${activeTab === 'cardapio' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('cardapio'); }}>
            <Utensils /><span>Cardápio</span>
          </a>
          <a href="#" className={`nav-item ${activeTab === 'plantao' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('plantao'); }}>
            <ClipboardEdit /><span>Plantão</span>
          </a>
        </nav>
      ) : (
        <nav className="bottom-nav">
          <a href="#" className={`nav-item ${activeTab === 'sinais' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('sinais'); }}>
            <Activity /><span>Sinais Vitais</span>
          </a>
          <a href="#" className={`nav-item ${activeTab === 'medicacoes' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('medicacoes'); }}>
            <Pill /><span>Medicação</span>
          </a>
          <a href="#" className={`nav-item ${activeTab === 'estoque' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('estoque'); }}>
            <PackageOpen /><span>Estoque</span>
          </a>
        </nav>
      )}
    </div>
  );
}
