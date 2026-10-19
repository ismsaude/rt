import { useCallback, useEffect, useState } from 'react';
import {
  Eye, EyeOff, Pencil, Save, Shield, Trash2, UserCheck, UserPlus, UserX, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { formatCouncil, PROFESSIONAL_COUNCILS, UFS } from '../../lib/clinical';
import {
  Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader,
  SelectField, SkeletonList, Table, TextField, useConfirm, useToast,
} from '../ui';

const ROLES = [
  { value: 'CUIDADOR',   label: 'Cuidador(a)',      description: 'Tarefas, cardápio e passagem de plantão', tone: 'primary' },
  { value: 'ENFERMEIRO', label: 'Téc. enfermagem',  description: 'Sinais vitais, medicação, estoque e agenda', tone: 'info' },
  { value: 'ADMIN',      label: 'Supervisão',       description: 'Acesso completo ao sistema', tone: 'warning' },
  { value: 'DIRETOR',    label: 'Diretoria',        description: 'Acesso completo e conta protegida', tone: 'danger' },
];

const roleMeta = (value) => ROLES.find((r) => r.value === value) || ROLES[0];

const EMPTY = {
  name: '', cpf: '', email: '', password: '', role: 'CUIDADOR',
  job_title: '', professional_council: '', professional_id: '', professional_uf: '',
};

/** Perfis que exercem profissão regulamentada por conselho. */
const ROLES_COM_CONSELHO = ['ENFERMEIRO', 'ADMIN', 'DIRETOR'];

export default function AccessManagement({ currentUser }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('User').select('*').order('name');
    if (error) {
      toast.error('Não foi possível carregar a equipe.');
      setUsers([]);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY);
    setEditingId(null);
    setShowPassword(false);
    setFormOpen(true);
  };

  const openEdit = (user) => {
    if (user.role === 'DIRETOR' && currentUser?.role !== 'DIRETOR') {
      toast.warning('Contas de diretoria só podem ser editadas pelo próprio diretor.');
      return;
    }
    // A senha não é trazida para a tela: em branco significa "manter a atual".
    setForm({
      name: user.name || '',
      cpf: user.cpf || '',
      email: user.email || '',
      password: '',
      role: user.role || 'CUIDADOR',
      job_title: user.job_title || '',
      professional_council: user.professional_council || '',
      professional_id: user.professional_id || '',
      professional_uf: user.professional_uf || '',
    });
    setEditingId(user.id);
    setShowPassword(false);
    setFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.warning('Nome e e-mail são obrigatórios.');
      return;
    }
    if (!editingId && form.password.length < 6) {
      toast.warning('Defina uma senha inicial de ao menos 6 caracteres.');
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      job_title: form.job_title.trim(),
      professional_council: form.professional_council,
      professional_id: form.professional_id.trim(),
      professional_uf: form.professional_uf,
      updatedAt: new Date().toISOString(),
    };
    // Só grava a senha quando o campo foi preenchido.
    if (form.password) payload.password = form.password;

    const { error } = editingId
      ? await supabase.from('User').update(payload).eq('id', editingId)
      : await supabase.from('User').insert([{ id: uid(), ...payload }]);

    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    setFormOpen(false);
    setForm(EMPTY);
    setEditingId(null);
    toast.success(editingId ? 'Usuário atualizado.' : 'Usuário cadastrado.');
    load();
  };

  const toggleActive = async (user) => {
    if (user.role === 'DIRETOR') {
      toast.warning('Contas de diretoria são protegidas e não podem ser inativadas.');
      return;
    }
    if (user.id === currentUser?.id) {
      toast.warning('Você não pode inativar o próprio acesso.');
      return;
    }

    const inativar = user.active !== false;
    const ok = await confirm(inativar ? {
      title: 'Inativar acesso',
      message: `${user.name} não conseguirá mais entrar no sistema, e quem estiver com a sessão aberta será desconectado.`,
      warning: 'O cadastro e todos os registros desta pessoa continuam guardados. Dá para reativar depois.',
      confirmLabel: 'Inativar',
    } : {
      title: 'Reativar acesso',
      message: `${user.name} voltará a entrar no sistema com a senha que já tinha.`,
      confirmLabel: 'Reativar',
      tone: 'primary',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('User')
      .update({ active: !inativar, updatedAt: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      toast.error(`Erro ao ${inativar ? 'inativar' : 'reativar'}: ${error.message}`);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: !inativar } : u)));
    toast.success(inativar ? 'Acesso inativado.' : 'Acesso reativado.');
  };

  const remove = async (user) => {
    if (user.role === 'DIRETOR') {
      toast.warning('Contas de diretoria são protegidas e não podem ser excluídas.');
      return;
    }

    const ok = await confirm({
      title: 'Excluir usuário',
      message: `O cadastro de ${user.name} será apagado de vez.`,
      warning: 'Para quem saiu da empresa, prefira inativar: o cadastro fica guardado e dá para reativar. Os registros já lançados permanecem no prontuário.',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('User').delete().eq('id', user.id);
    if (error) {
      toast.error('Erro ao excluir o usuário.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setFormOpen(false);
    setEditingId(null);
    toast.success('Usuário excluído.');
  };

  const editingUser = editingId ? users.find((u) => u.id === editingId) : null;

  return (
    <div>
      <PageHeader
        title="Gestão de acessos"
        description="Equipe cadastrada e o que cada perfil pode ver no sistema."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={openCreate}>
            Novo usuário
          </Button>
        }
      />

      {loading ? (
        <SkeletonList count={4} />
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum usuário cadastrado"
            description="Cadastre a equipe para liberar o acesso ao sistema."
            action={<Button variant="primary" icon={UserPlus} onClick={openCreate}>Cadastrar usuário</Button>}
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Acesso</th>
              <th>Perfil</th>
              <th>Registro</th>
              <th style={{ textAlign: 'center', width: 1 }}>Inativar</th>
              <th style={{ textAlign: 'center', width: 1 }}>Editar</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const meta = roleMeta(user.role);
              const protectedAccount = user.role === 'DIRETOR';
              const inactive = user.active === false;
              const isSelf = user.id === currentUser?.id;
              return (
                <tr key={user.id} style={inactive ? { opacity: 0.6 } : undefined}>
                  <td>
                    <div className="u-row u-gap-3">
                      <Avatar name={user.name} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div className="table__cell-strong">{user.name}</div>
                        <div className="table__cell-muted" style={{ fontSize: 'var(--text-xs)' }}>
                          CPF: {user.cpf || 'não informado'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table__cell-muted">{user.email}</td>
                  <td>
                    <div className="u-stack u-gap-1" style={{ alignItems: 'flex-start' }}>
                      <Badge tone={meta.tone} icon={protectedAccount ? Shield : undefined}>
                        {meta.label}
                      </Badge>
                      {inactive && <Badge tone="neutral">Inativo</Badge>}
                    </div>
                  </td>
                  <td className="table__cell-muted">
                    {formatCouncil(user) || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="ghost" size="sm" iconOnly
                      icon={inactive ? UserCheck : UserX}
                      onClick={() => toggleActive(user)}
                      disabled={protectedAccount || isSelf}
                      title={inactive ? 'Reativar acesso' : 'Inativar acesso'}
                      aria-label={`${inactive ? 'Reativar' : 'Inativar'} ${user.name}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="ghost" size="sm" iconOnly icon={Pencil}
                      onClick={() => openEdit(user)}
                      title="Editar cadastro"
                      aria-label={`Editar ${user.name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar usuário' : 'Novo membro da equipe'}
        description={editingId ? 'Deixe a senha em branco para mantê-la inalterada.' : undefined}
        footer={
          <>
            {editingUser && editingUser.role !== 'DIRETOR' && (
              <Button
                variant="danger-ghost" icon={Trash2}
                onClick={() => remove(editingUser)}
                style={{ marginRight: 'auto' }}
              >
                Excluir
              </Button>
            )}
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon={Save} onClick={submit} loading={saving}>
              {editingId ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="u-stack u-gap-4">
          <TextField
            label="Nome completo" required autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div className="field-row">
            <TextField
              label="CPF" placeholder="000.000.000-00"
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
            />
            <TextField
              label="E-mail de acesso" type="email" required
              autoCapitalize="none" spellCheck="false"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <SelectField
            label="Perfil de acesso"
            hint={roleMeta(form.role).description}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>

          <TextField
            label="Cargo na assinatura"
            hint="Como aparece nos documentos. Ex.: Supervisora Residência Terapêutica"
            value={form.job_title}
            onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
          />

          {ROLES_COM_CONSELHO.includes(form.role) && (
            <div>
              <p className="divider-label" style={{ marginBottom: 'var(--space-3)' }}>
                Conselho de classe
              </p>
              <div className="field-row">
                <SelectField
                  label="Conselho"
                  value={form.professional_council}
                  onChange={(e) => setForm((f) => ({ ...f, professional_council: e.target.value }))}
                >
                  <option value="">Não informado</option>
                  {PROFESSIONAL_COUNCILS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </SelectField>

                <TextField
                  label="Número da inscrição"
                  placeholder="50.834"
                  value={form.professional_id}
                  onChange={(e) => setForm((f) => ({ ...f, professional_id: e.target.value }))}
                />

                <SelectField
                  label="UF"
                  hint="Quando o conselho for regional"
                  value={form.professional_uf}
                  onChange={(e) => setForm((f) => ({ ...f, professional_uf: e.target.value }))}
                >
                  <option value="">—</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </SelectField>
              </div>

              {formatCouncil(form) && (
                <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                  Sairá na assinatura como: <strong>{formatCouncil(form)}</strong>
                </span>
              )}
            </div>
          )}

          <TextField
            label={editingId ? 'Nova senha (opcional)' : 'Senha inicial'}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required={!editingId}
            hint={editingId ? 'Preencha apenas se quiser redefinir a senha.' : 'Mínimo de 6 caracteres.'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
        </form>
      </Modal>
    </div>
  );
}
