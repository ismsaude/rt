import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Pill, RotateCcw, Send, XCircle,
} from 'lucide-react';
import {
  buildSchedule, decrementStock, DOSE_STATUS, loadDoses, loadMedications,
  registerDose, undoDose,
} from '../../lib/medications';
import { formatTime, toISODate } from '../../lib/format';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader,
  Segmented, SkeletonList, Textarea, useToast,
} from '../ui';

const TODOS = '__todos__';

export default function MedicationAdmin({ currentUser, role }) {
  const toast = useToast();

  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState(TODOS);
  const [refusingKey, setRefusingKey] = useState(null);
  const [justification, setJustification] = useState('');
  const [busyKey, setBusyKey] = useState(null);

  const hoje = toISODate(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: meds, error }, { data: registros }] = await Promise.all([
      loadMedications(),
      loadDoses(hoje),
    ]);

    if (error) toast.error('Não foi possível carregar as medicações.');
    setDoses(buildSchedule(meds, registros, hoje));
    setLoading(false);
  }, [toast, hoje]);

  useEffect(() => { load(); }, [load]);

  const times = useMemo(
    () => Array.from(new Set(doses.map((d) => d.time))).sort(),
    [doses]
  );

  const visible = useMemo(
    () => (timeFilter === TODOS ? doses : doses.filter((d) => d.time === timeFilter)),
    [doses, timeFilter]
  );

  const byResident = useMemo(() => {
    const groups = new Map();
    visible.forEach((d) => {
      if (!groups.has(d.residentName)) groups.set(d.residentName, []);
      groups.get(d.residentName).push(d);
    });
    return groups;
  }, [visible]);

  const pendentes = doses.filter((d) => !d.status).length;

  /* ---------------- Ações ---------------- */

  const marcar = async (dose, status, motivo = '') => {
    setBusyKey(dose.key);

    const { duplicada, error } = await registerDose(dose, {
      status,
      justification: motivo,
      user: { id: currentUser?.id, name: currentUser?.name, role },
    });

    if (duplicada) {
      toast.warning('Esta dose já havia sido registrada por outra pessoa. Atualizando a lista.');
      setBusyKey(null);
      load();
      return;
    }

    if (error) {
      toast.error(`Não foi possível registrar: ${error.message}`);
      setBusyKey(null);
      return;
    }

    if (status === DOSE_STATUS.ADMINISTERED) {
      const { novo } = await decrementStock(dose.medicationId, dose.stock);
      if (novo <= dose.minStock) {
        toast.warning(`Estoque baixo: restam ${novo} unidades de ${dose.medicationName}.`);
      }
    }

    setBusyKey(null);
    setRefusingKey(null);
    setJustification('');
    load();
  };

  const desfazer = async (dose) => {
    setBusyKey(dose.key);
    const { error } = await undoDose(dose.doseId);
    setBusyKey(null);

    if (error) {
      toast.error('Não foi possível desfazer o registro.');
      return;
    }
    toast.success('Registro desfeito.');
    load();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Medicação" description="Carregando…" />
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Medicação de hoje"
        description={
          pendentes > 0
            ? `${pendentes} dose(s) ainda não checada(s).`
            : 'Todas as doses do dia foram checadas.'
        }
      />

      {doses.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Alert tone="info">
            A checagem é compartilhada: assim que alguém marca uma dose, ela aparece
            marcada para toda a equipe. Se a técnica já deu, a cuidadora vê e não repete.
          </Alert>
        </div>
      )}

      {times.length > 1 && (
        <div style={{ marginBottom: 'var(--space-5)', overflowX: 'auto' }}>
          <Segmented
            ariaLabel="Filtrar por horário"
            value={timeFilter}
            onChange={setTimeFilter}
            options={[
              { value: TODOS, label: 'Todos', icon: Clock },
              ...times.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>
      )}

      {byResident.size === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="Nenhuma medicação cadastrada"
            description="Cadastre os medicamentos e seus horários em Estoque Enfermagem para que apareçam aqui todos os dias."
          />
        </Card>
      ) : (
        <div className="u-stack u-gap-4">
          {Array.from(byResident.entries()).map(([resident, list]) => (
            <Card key={resident}>
              <CardHeader title={resident} icon={Pill} />
              <CardBody flush>
                {list.map((dose, idx) => {
                  const feito = dose.status === DOSE_STATUS.ADMINISTERED;
                  const recusado = dose.status === DOSE_STATUS.REFUSED;
                  const ocupado = busyKey === dose.key;

                  return (
                    <div
                      key={dose.key}
                      style={{
                        padding: 'var(--space-4) var(--space-5)',
                        borderBottom:
                          idx === list.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                        background: feito ? 'var(--success-subtle)' : recusado ? 'var(--danger-subtle)' : undefined,
                      }}
                    >
                      <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-3)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="u-row u-gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                            <Badge tone="primary" icon={Clock}>{dose.time}</Badge>
                            {dose.stock <= dose.minStock && (
                              <Badge tone="danger" icon={AlertTriangle}>Estoque baixo</Badge>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-base)',
                              fontWeight: 'var(--weight-semibold)',
                              color: 'var(--text-strong)',
                            }}
                          >
                            {dose.medicationName}
                          </div>
                        </div>

                        {feito && <Badge tone="success" icon={CheckCircle2}>Tomou</Badge>}
                        {recusado && <Badge tone="danger" icon={XCircle}>Recusou</Badge>}
                      </div>

                      {/* Quem registrou — evita dose repetida */}
                      {dose.status && (
                        <div
                          className="u-between u-gap-3 u-wrap"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
                        >
                          <span>
                            Registrado por <strong>{dose.givenBy}</strong>
                            {dose.givenAt && ` às ${formatTime(dose.givenAt)}`}
                          </span>
                          <Button
                            variant="ghost" size="sm" icon={RotateCcw}
                            onClick={() => desfazer(dose)}
                            loading={ocupado}
                          >
                            Desfazer
                          </Button>
                        </div>
                      )}

                      {recusado && dose.justification && (
                        <p
                          style={{
                            marginTop: 'var(--space-2)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--danger-text)',
                            fontStyle: 'italic',
                          }}
                        >
                          Motivo: {dose.justification}
                        </p>
                      )}

                      {/* Dois botões grandes — é o que a equipe usa com pressa */}
                      {!dose.status && refusingKey !== dose.key && (
                        <div className="u-row u-gap-2">
                          <Button
                            variant="success" size="lg" icon={CheckCircle2}
                            className="u-grow" loading={ocupado}
                            onClick={() => marcar(dose, DOSE_STATUS.ADMINISTERED)}
                          >
                            Tomou
                          </Button>
                          <Button
                            variant="secondary" size="lg" icon={XCircle}
                            className="u-grow" disabled={ocupado}
                            onClick={() => { setRefusingKey(dose.key); setJustification(''); }}
                          >
                            Recusou
                          </Button>
                        </div>
                      )}

                      {refusingKey === dose.key && (
                        <div
                          style={{
                            padding: 'var(--space-3)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <Textarea
                            placeholder="Por que o morador recusou? (obrigatório)"
                            rows={2}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            style={{ marginBottom: 'var(--space-3)' }}
                            autoFocus
                          />
                          <div className="u-row u-gap-2">
                            <Button
                              variant="secondary" size="sm" className="u-grow"
                              onClick={() => setRefusingKey(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="primary" size="sm" icon={Send} className="u-grow"
                              loading={ocupado}
                              onClick={() => {
                                if (!justification.trim()) {
                                  toast.warning('A justificativa da recusa é obrigatória.');
                                  return;
                                }
                                marcar(dose, DOSE_STATUS.REFUSED, justification.trim());
                              }}
                            >
                              Registrar recusa
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
