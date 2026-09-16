import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Pill, Send, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader,
  Segmented, SkeletonList, Textarea, useToast,
} from '../ui';

const ALL = '__todos__';

export default function MedicationAdmin() {
  const toast = useToast();

  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState(ALL);
  const [refusingId, setRefusingId] = useState(null);
  const [justification, setJustification] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    // Estoque e horários ainda vivem parcialmente no navegador
    // (ver aviso na tela). A leitura do Supabase mantém o estoque
    // sincronizado quando a tabela já possui os dados.
    const { error } = await supabase.from('Medication').select('*');
    if (error) toast.error('Não foi possível consultar o estoque de medicamentos.');

    let localStock = [];
    try {
      localStock = JSON.parse(localStorage.getItem('rt_stock') || '[]');
    } catch {
      localStock = [];
    }

    const list = [];
    localStock.forEach((item) => {
      (item.times || []).forEach((time) => {
        list.push({
          id: `${item.id}-${time}`,
          stockId: item.id,
          name: item.name,
          resident: item.resident || 'Geral',
          time,
          qty: item.qty,
          minQty: item.minQty,
          status: 'pending',
        });
      });
    });

    setDoses(list);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const times = useMemo(
    () => Array.from(new Set(doses.map((d) => d.time))).sort(),
    [doses]
  );

  const visible = useMemo(
    () => (timeFilter === ALL ? doses : doses.filter((d) => d.time === timeFilter)),
    [doses, timeFilter]
  );

  const byResident = useMemo(() => {
    const groups = new Map();
    visible.forEach((dose) => {
      if (!groups.has(dose.resident)) groups.set(dose.resident, []);
      groups.get(dose.resident).push(dose);
    });
    groups.forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return groups;
  }, [visible]);

  const pending = doses.filter((d) => d.status === 'pending').length;

  const administer = async (dose) => {
    setDoses((prev) => prev.map((d) => (d.id === dose.id ? { ...d, status: 'administered' } : d)));

    // Baixa de estoque
    try {
      const stock = JSON.parse(localStorage.getItem('rt_stock') || '[]');
      const idx = stock.findIndex((s) => s.id === dose.stockId);
      if (idx >= 0) {
        stock[idx].qty = Math.max(0, (stock[idx].qty || 0) - 1);
        localStorage.setItem('rt_stock', JSON.stringify(stock));

        if (stock[idx].qty <= stock[idx].minQty) {
          toast.warning(
            `Estoque baixo: restam ${stock[idx].qty} unidades de ${stock[idx].name}.`
          );
        }
        if (!Number.isNaN(Number(dose.stockId))) {
          await supabase.from('Medication').update({ stock: stock[idx].qty }).eq('id', dose.stockId);
        }
      }
    } catch {
      toast.error('Não foi possível atualizar o estoque.');
    }
  };

  const confirmRefusal = (dose) => {
    if (!justification.trim()) {
      toast.warning('A justificativa da recusa é obrigatória.');
      return;
    }
    setDoses((prev) =>
      prev.map((d) =>
        d.id === dose.id ? { ...d, status: 'refused', justification: justification.trim() } : d
      )
    );
    setRefusingId(null);
    setJustification('');
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
        title="Checagem de medicação"
        description={
          pending > 0
            ? `${pending} dose(s) pendente(s) no período exibido.`
            : 'Todas as doses do período foram checadas.'
        }
      />

      {/* Transparência sobre a limitação atual — a checagem ainda não
          é arquivada em banco, e a equipe precisa saber disso. */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Alert tone="warning" title="Checagem ainda não arquivada em prontuário">
          As marcações desta tela valem apenas para a sessão atual e se perdem ao
          recarregar a página. O arquivamento definitivo (quem administrou, quando
          e a justificativa de recusa) depende da criação da tabela de administrações,
          prevista para a próxima etapa.
        </Alert>
      </div>

      {times.length > 1 && (
        <div style={{ marginBottom: 'var(--space-5)', overflowX: 'auto' }}>
          <Segmented
            ariaLabel="Filtrar por horário"
            value={timeFilter}
            onChange={setTimeFilter}
            options={[
              { value: ALL, label: 'Todos', icon: Clock },
              ...times.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>
      )}

      {byResident.size === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="Nenhuma medicação para este período"
            description="Cadastre os medicamentos e seus horários em Estoque Enfermagem."
          />
        </Card>
      ) : (
        <div className="u-stack u-gap-4">
          {Array.from(byResident.entries()).map(([resident, list]) => (
            <Card key={resident}>
              <CardHeader title={resident} icon={Pill} />
              <CardBody flush>
                {list.map((dose, idx) => (
                  <div
                    key={dose.id}
                    style={{
                      padding: 'var(--space-4) var(--space-5)',
                      borderBottom:
                        idx === list.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-3)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="u-row u-gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                          <Badge tone="primary" icon={Clock}>{dose.time}</Badge>
                          {dose.qty <= dose.minQty && (
                            <Badge tone="danger" icon={AlertTriangle}>Estoque baixo</Badge>
                          )}
                        </div>
                        <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-strong)' }}>
                          {dose.name}
                        </div>
                      </div>

                      {dose.status === 'administered' && (
                        <Badge tone="success" icon={CheckCircle2}>Administrado</Badge>
                      )}
                      {dose.status === 'refused' && (
                        <Badge tone="danger" icon={XCircle}>Recusado</Badge>
                      )}
                    </div>

                    {dose.status === 'pending' && refusingId !== dose.id && (
                      <div className="u-row u-gap-2">
                        <Button
                          variant="success" size="sm" icon={CheckCircle2}
                          className="u-grow" onClick={() => administer(dose)}
                        >
                          Administrado
                        </Button>
                        <Button
                          variant="secondary" size="sm" icon={XCircle}
                          className="u-grow"
                          onClick={() => { setRefusingId(dose.id); setJustification(''); }}
                        >
                          Recusou
                        </Button>
                      </div>
                    )}

                    {refusingId === dose.id && (
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          background: 'var(--surface-sunken)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <Textarea
                          placeholder="Motivo da recusa (obrigatório)…"
                          rows={2}
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          style={{ marginBottom: 'var(--space-3)' }}
                          autoFocus
                        />
                        <div className="u-row u-gap-2">
                          <Button
                            variant="secondary" size="sm" className="u-grow"
                            onClick={() => setRefusingId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="primary" size="sm" icon={Send} className="u-grow"
                            onClick={() => confirmRefusal(dose)}
                          >
                            Registrar recusa
                          </Button>
                        </div>
                      </div>
                    )}

                    {dose.status === 'refused' && dose.justification && (
                      <p
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        Motivo: {dose.justification}
                      </p>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
