import { useEffect, useState } from 'react';
import { PenLine, ShieldCheck } from 'lucide-react';
import { assinar } from '../lib/signature';
import { Alert, Button, Modal, TextField } from './ui';

/**
 * Confirma a senha pessoal e devolve os dados da assinatura.
 *
 * `onSigned` recebe o objeto pronto para ser gravado junto do registro;
 * a tela decide o que fazer com ele.
 */
export default function SignatureModal({
  open, onClose, onSigned, currentUser, title = 'Assinatura eletrônica', description, children,
}) {
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [assinando, setAssinando] = useState(false);

  useEffect(() => {
    if (open) { setPassword(''); setErro(''); }
  }, [open]);

  const confirmar = async (e) => {
    e?.preventDefault();
    setErro('');
    setAssinando(true);

    const { ok, motivo, assinatura } = await assinar({ user: currentUser, password });
    setAssinando(false);

    if (!ok) { setErro(motivo); return; }
    onSigned(assinatura);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={PenLine} onClick={confirmar} loading={assinando}>
            Assinar
          </Button>
        </>
      }
    >
      <form onSubmit={confirmar} className="u-stack u-gap-4">
        <Alert tone="info" icon={ShieldCheck}>
          O registro será arquivado em nome de{' '}
          <strong>{currentUser?.name || 'você'}</strong>, com data, hora, IP de
          origem e o aparelho utilizado.
        </Alert>

        {children}

        <TextField
          label="Sua senha de acesso"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={erro}
        />
      </form>
    </Modal>
  );
}
