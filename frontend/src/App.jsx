import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Calendar, CalendarDays, CheckSquare, ClipboardEdit, Database,
  FileText, KeyRound, LayoutDashboard, LogOut, Menu as MenuIcon, PackageOpen,
  Pill, ShoppingCart, Shield, Utensils, X,
} from 'lucide-react';

import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import {
  Avatar, Button, ToastProvider, ConfirmProvider, useToast, TextField,
  Modal,
} from './components/ui';
import { supabase } from './lib/supabase';
import { firstName } from './lib/format';

// Operacional — cuidador
import Dashboard from './components/Dashboard';
import ShiftHandover from './components/ShiftHandover';
import DailyMenu from './components/DailyMenu';

// Operacional — enfermagem
import VitalsControl from './components/nurse/VitalsControl';
import MedicationAdmin from './components/nurse/MedicationAdmin';
import PharmacyStock from './components/nurse/PharmacyStock';
import Programmation from './components/nurse/Programmation';

// Gestão
import Overview from './components/admin/Overview';
import ScheduleManagement from './components/admin/ScheduleManagement';
import InventoryManagement from './components/admin/InventoryManagement';
import ResidentReports from './components/admin/ResidentReports';
import DataRegistration from './components/admin/DataRegistration';
import AccessManagement from './components/admin/AccessManagement';

/* ------------------------------------------------------------------
   Mapa de navegação — fonte única para menu lateral, barra inferior
   e roteamento. Adicionar uma tela é adicionar uma linha aqui.
   ------------------------------------------------------------------ */
const VIEWS = {
  inicio:       { label: 'Painel',               short: 'Painel',    icon: LayoutDashboard, Component: Overview },
  cadastros:    { label: 'Central de Cadastros', short: 'Cadastros', icon: Database,     Component: DataRegistration },
  escalas:      { label: 'Gestão de Escalas',    short: 'Escalas',   icon: CalendarDays, Component: ScheduleManagement },
  estoque_admin:{ label: 'Estoque e Compras',    short: 'Compras',   icon: ShoppingCart, Component: InventoryManagement },
  relatorios:   { label: 'Relatórios',           short: 'Relatórios',icon: FileText,     Component: ResidentReports },
  acessos:      { label: 'Gestão de Acessos',    short: 'Acessos',   icon: Shield,       Component: AccessManagement },

  tarefas:      { label: 'Tarefas do Dia',       short: 'Tarefas',   icon: CheckSquare,  Component: Dashboard },
  cardapio:     { label: 'Cardápio',             short: 'Cardápio',  icon: Utensils,     Component: DailyMenu },
  plantao:      { label: 'Passagem de Plantão',  short: 'Plantão',   icon: ClipboardEdit,Component: ShiftHandover },

  sinais:       { label: 'Sinais Vitais',        short: 'Sinais',    icon: Activity,     Component: VitalsControl },
  medicacoes:   { label: 'Medicação',            short: 'Medicação', icon: Pill,         Component: MedicationAdmin },
  estoque:      { label: 'Estoque Enfermagem',   short: 'Estoque',   icon: PackageOpen,  Component: PharmacyStock },
  programacao:  { label: 'Agenda / Programação', short: 'Agenda',    icon: Calendar,     Component: Programmation },
};

const ADMIN_MENU = [
  { section: 'Visão geral', items: ['inicio'] },
  { section: 'Sistema e gestão', items: ['cadastros', 'escalas', 'estoque_admin', 'relatorios', 'acessos'] },
  { section: 'Operacional — cuidador', items: ['tarefas', 'cardapio', 'plantao'] },
  { section: 'Operacional — enfermagem', items: ['sinais', 'medicacoes', 'estoque', 'programacao'] },
];

const NAV_BY_ROLE = {
  cuidador: ['tarefas', 'cardapio', 'plantao'],
  enfermeiro: ['sinais', 'medicacoes', 'estoque', 'programacao'],
};

const HOME_BY_ROLE = { admin: 'inicio', enfermeiro: 'sinais', cuidador: 'tarefas' };

const ROLE_LABEL = {
  admin: 'Administração',
  enfermeiro: 'Técnico de enfermagem',
  cuidador: 'Cuidador(a)',
};

/* ------------------------------------------------------------------ */

function BrandMark({ className }) {
  return (
    <img
      src="/logo.png"
      alt="Aurean Residência Terapêutica"
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

/** Troca de senha do próprio usuário. */
function PasswordModal({ open, onClose, currentUser }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmation('');
      setError('');
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As duas senhas não conferem.');
      return;
    }

    setSaving(true);
    const { error: dbError } = await supabase
      .from('User')
      .update({ password })
      .eq('id', currentUser?.id);
    setSaving(false);

    if (dbError) {
      setError('Não foi possível alterar a senha. Tente novamente.');
      return;
    }
    toast.success('Senha alterada com sucesso.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alterar minha senha"
      description="A nova senha passa a valer no próximo acesso."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Salvar senha</Button>
        </>
      }
    >
      <form onSubmit={submit} className="u-stack u-gap-4">
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo de 6 caracteres"
        />
        <TextField
          label="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          error={error}
        />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Workspace({ role, currentUser, onLogout }) {
  const [activeView, setActiveView] = useState(() => HOME_BY_ROLE[role] || 'tarefas');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const view = VIEWS[activeView] || VIEWS[HOME_BY_ROLE[role]];
  const ViewComponent = view.Component;

  const go = useCallback((key) => {
    setActiveView(key);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fecha a gaveta com Escape
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const userBlock = (
    <div className="sidebar__user">
      <Avatar name={currentUser?.name} />
      <div className="sidebar__user-info">
        <div className="sidebar__user-name">{currentUser?.name || 'Usuário'}</div>
        <div className="sidebar__user-role">{ROLE_LABEL[role]}</div>
      </div>
    </div>
  );

  /* ---------------- Perfil administrativo: menu lateral ---------------- */
  if (role === 'admin') {
    return (
      <div className="shell">
        {drawerOpen && <div className="sidebar__scrim" onClick={() => setDrawerOpen(false)} />}

        <aside className="sidebar" data-open={drawerOpen}>
          <div className="sidebar__brand">
            <BrandMark className="sidebar__logo" />
            <div className="sidebar__brand-text">
              <span className="sidebar__brand-name">Aurean</span>
              <span className="sidebar__brand-sub">Residência Terapêutica</span>
            </div>
          </div>

          <nav className="sidebar__nav" aria-label="Navegação principal">
            {ADMIN_MENU.map((group) => (
              <React.Fragment key={group.section}>
                <div className="sidebar__section">{group.section}</div>
                {group.items.map((key) => {
                  const item = VIEWS[key];
                  const Icon = item.icon;
                  return (
                    <button
                      key={key}
                      className="sidebar__link"
                      aria-current={activeView === key ? 'page' : undefined}
                      onClick={() => go(key)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>

          <div className="sidebar__footer">
            {userBlock}
            <div className="u-row u-gap-2">
              <Button variant="ghost" size="sm" icon={KeyRound} onClick={() => setPasswordOpen(true)} className="u-grow">
                Senha
              </Button>
              <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout} className="u-grow">
                Sair
              </Button>
            </div>
          </div>
        </aside>

        <div className="shell__main">
          <header className="shell__topbar">
            <Button
              variant="ghost"
              size="md"
              iconOnly
              icon={drawerOpen ? X : MenuIcon}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={drawerOpen}
            />
            <BrandMark className="app__logo" />
            <Button variant="ghost" size="md" iconOnly icon={LogOut} onClick={onLogout} aria-label="Sair" />
          </header>

          <main className="shell__content">
            <ErrorBoundary key={activeView}>
              <ViewComponent role={role} currentUser={currentUser} />
            </ErrorBoundary>
          </main>
        </div>

        <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} currentUser={currentUser} />
      </div>
    );
  }

  /* ---------------- Perfis operacionais: barra inferior ---------------- */
  const navKeys = NAV_BY_ROLE[role] || NAV_BY_ROLE.cuidador;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__identity">
          <BrandMark className="app__logo" />
          <div className="app__greeting">
            <div className="app__title">Olá, {firstName(currentUser?.name) || 'equipe'}</div>
            <div className="app__subtitle">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <div className="u-row u-gap-1">
          <Button
            variant="ghost" size="md" iconOnly icon={KeyRound}
            onClick={() => setPasswordOpen(true)} aria-label="Alterar senha"
          />
          <Button
            variant="ghost" size="md" iconOnly icon={LogOut}
            onClick={onLogout} aria-label="Sair do sistema"
          />
        </div>
      </header>

      <main className="app__main">
        <ErrorBoundary key={activeView}>
          <ViewComponent role={role} currentUser={currentUser} />
        </ErrorBoundary>
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {navKeys.map((key) => {
          const item = VIEWS[key];
          const Icon = item.icon;
          return (
            <button
              key={key}
              className="bottom-nav__item"
              aria-current={activeView === key ? 'page' : undefined}
              onClick={() => go(key)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{item.short}</span>
            </button>
          );
        })}
      </nav>

      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} currentUser={currentUser} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem('rt_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback((role, user) => {
    const next = { role, user };
    setSession(next);
    try {
      localStorage.setItem('rt_session', JSON.stringify(next));
    } catch {
      /* armazenamento indisponível — a sessão vale só para esta aba */
    }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    try {
      ['rt_session', 'rt_auth', 'rt_user', 'rt_role'].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignora */
    }
  }, []);

  const content = useMemo(() => {
    if (!session) return <Login onLogin={handleLogin} />;
    return (
      <Workspace
        role={session.role}
        currentUser={session.user}
        onLogout={handleLogout}
      />
    );
  }, [session, handleLogin, handleLogout]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>{content}</ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
