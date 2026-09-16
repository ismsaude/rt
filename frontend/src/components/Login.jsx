import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Alert, Button, TextField } from './ui';

const ROLE_MAP = {
  CUIDADOR: 'cuidador',
  ENFERMEIRO: 'enfermeiro',
  ADMIN: 'admin',
  DIRETOR: 'admin',
};

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ATENÇÃO: acesso mestre de desenvolvimento. Removê-lo faz parte
    // da etapa de autenticação (Supabase Auth) ainda pendente.
    if (email === 'dev@aurean.com' && password === 'admin') {
      onLogin('admin', { name: 'Desenvolvedor', role: 'ADMIN', email });
      setLoading(false);
      return;
    }

    try {
      const { data, error: dbError } = await supabase
        .from('User')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password', password)
        .maybeSingle();

      if (dbError) {
        setError('Não foi possível conectar ao servidor. Verifique a internet e tente novamente.');
      } else if (!data) {
        setError('E-mail ou senha incorretos.');
      } else if (data.active === false) {
        setError('Este acesso está desativado. Procure a supervisão.');
      } else {
        onLogin(ROLE_MAP[data.role] || 'cuidador', data);
      }
    } catch {
      setError('Erro inesperado ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__inner">
          <img
            src="/logo.png"
            alt="Aurean Residência Terapêutica"
            className="login__logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />

          <h1 className="login__title">Acessar o sistema</h1>
          <p className="login__subtitle">
            Entre com as credenciais fornecidas pela supervisão.
          </p>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            {error && <Alert tone="danger">{error}</Alert>}

            <TextField
              label="E-mail"
              type="email"
              icon={Mail}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <TextField
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              action={
                <button
                  type="button"
                  className="input-group__action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />

            <Button type="submit" variant="primary" size="lg" block loading={loading} icon={LogIn}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <p className="login__footer">
            Esqueceu a senha ou precisa de acesso?<br />
            Procure a supervisão da residência.
          </p>
        </div>
      </div>

      <aside className="login__aside">
        <div className="login__aside-content">
          <p className="login__aside-quote">
            O cuidado de cada dia, registrado com o rigor que a casa merece.
          </p>
          <p className="login__aside-caption">
            Plantões, medicação, sinais vitais e evolução dos moradores reunidos
            em um só lugar — para que a equipe cuide das pessoas, e o sistema
            cuide do registro.
          </p>
        </div>
      </aside>
    </div>
  );
}
