import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Acesso Desenvolvedor (Master)
    if (email === 'dev@aurean.com' && password === 'admin') {
      onLogin('admin', { name: 'Desenvolvedor', role: 'ADMIN', email: 'dev@aurean.com' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('User')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) {
        setError('E-mail ou senha incorretos.');
      } else {
        let userRole = 'admin';
        if (data.role === 'CUIDADOR') userRole = 'cuidador';
        else if (data.role === 'ENFERMEIRO') userRole = 'enfermeiro';
        else if (data.role === 'ADMIN' || data.role === 'DIRETOR') userRole = 'admin';

        onLogin(userRole, data);
      }
    } catch (err) {
      setError('Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', color: 'var(--primary-dark)', marginBottom: '8px' }}>Bem-vindo</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Aurean Residência Terapêutica</p>

        {error && (
          <div style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Mail size={20} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
            <input 
              type="email" 
              required
              className="textarea-huge" 
              placeholder="Seu e-mail" 
              style={{ minHeight: '50px', padding: '12px 12px 12px 48px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
            <input 
              type="password" 
              required
              className="textarea-huge" 
              placeholder="Sua senha" 
              style={{ minHeight: '50px', padding: '12px 12px 12px 48px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-massive btn-primary" disabled={loading} style={{ marginTop: '16px', width: '100%' }}>
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
