import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, MESES } from '../../lib/format';
import {
  Alert, Avatar, Badge, Button, Card, EmptyState, Modal,
  PageHeader, SelectField, SkeletonList, Stat, StatGrid, Table, TextField,
  useToast,
} from '../ui';

const REGIMES = [
  'A definir', '12x36 diurno', '12x36 noturno',
  '8h diárias', '30h semanais', 'Folguista',
];

const ROLE_LABEL = {
  ADMIN: 'Supervisão',
  DIRETOR: 'Diretoria',
  ENFERMEIRO: 'Téc. enfermagem',
  CUIDADOR: 'Cuidador(a)',
};

/** Configuração de escala ainda não tem tabela própria no banco. */
function readLocalSchedule() {
  try {
    return JSON.parse(localStorage.getItem('rt_schedule') || '{}');
  } catch {
    return {};
  }
}

export default function ScheduleManagement() {
  const toast = useToast();

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'A definir', nextShift: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('User').select('*').order('name');

    if (error) {
      toast.error('Não foi possível carregar a equipe.');
      setTeam([]);
    } else {
      const config = readLocalSchedule();
      setTeam(
        (data || []).map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          active: u.active !== false,
          type: config[u.id]?.type || 'A definir',
          nextShift: config[u.id]?.nextShift || '',
        }))
      );
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const activeCount = useMemo(() => team.filter((u) => u.active).length, [team]);
  const scheduledCount = useMemo(
    () => team.filter((u) => u.type !== 'A definir').length,
    [team]
  );

  const now = new Date();
  const currentMonth = `${MESES[now.getMonth()]} de ${now.getFullYear()}`;

  const openEdit = (member) => {
    setForm({ type: member.type, nextShift: member.nextShift });
    setEditing(member);
  };

  const save = (e) => {
    e?.preventDefault();

    try {
      const config = readLocalSchedule();
      config[editing.id] = { type: form.type, nextShift: form.nextShift };
      localStorage.setItem('rt_schedule', JSON.stringify(config));
    } catch {
      toast.error('Não foi possível salvar a escala neste dispositivo.');
      return;
    }

    setTeam((prev) =>
      prev.map((u) => (u.id === editing.id ? { ...u, type: form.type, nextShift: form.nextShift } : u))
    );
    setEditing(null);
    toast.success('Escala atualizada neste dispositivo.');
  };

  return (
    <div>
      <PageHeader
        title="Gestão de escalas"
        description="Regime de trabalho e próximo plantão de cada membro da equipe."
      />

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Alert tone="warning" title="Escala salva apenas neste dispositivo">
          A configuração de regime e próximo plantão ainda não possui tabela no banco:
          ela fica guardada neste navegador e não é vista pelos outros usuários.
          A migração para o servidor está prevista na etapa de fundação de dados.
        </Alert>
      </div>

      {!loading && (
        <StatGrid style={{ marginBottom: 'var(--space-6)' }}>
          <Stat label="Mês de referência" value={currentMonth} icon={CalendarDays} />
          <Stat label="Equipe ativa" value={activeCount} hint={`de ${team.length} cadastrados`} icon={Users} />
          <Stat
            label="Com escala definida" value={scheduledCount}
            tone={scheduledCount < activeCount ? 'warning' : 'success'}
            hint={scheduledCount < activeCount ? `${activeCount - scheduledCount} pendente(s)` : 'Todos definidos'}
          />
        </StatGrid>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : team.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum funcionário cadastrado"
            description="Cadastre a equipe em Gestão de Acessos para montar a escala."
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Regime</th>
              <th>Próximo plantão</th>
              <th>Situação</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="u-row u-gap-3">
                    <Avatar name={member.name} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div className="table__cell-strong">{member.name}</div>
                      <div className="table__cell-muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {ROLE_LABEL[member.role] || member.role}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={member.type === 'A definir' ? 'neutral' : 'primary'}>
                    {member.type}
                  </Badge>
                </td>
                <td className="table__cell-muted">
                  {member.nextShift ? formatDate(member.nextShift) : '—'}
                </td>
                <td>
                  <Badge tone={member.active ? 'success' : 'neutral'} dot>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td>
                  <div className="table__actions">
                    <Button
                      variant="secondary" size="sm" icon={Pencil}
                      onClick={() => openEdit(member)}
                    >
                      Definir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Definir escala"
        description={editing?.name}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={save} className="u-stack u-gap-4">
          <SelectField
            label="Regime de trabalho"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>

          <TextField
            label="Próximo plantão" type="date"
            value={form.nextShift}
            onChange={(e) => setForm((f) => ({ ...f, nextShift: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
