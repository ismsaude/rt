import { useCallback, useEffect, useId, useState } from 'react';
import {
  Activity, ArrowLeft, CheckCircle2, ChevronRight, Droplets, Heart,
  Save, Thermometer, Wind,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/id';
import { formatDateTime } from '../../lib/format';
import {
  classifyBloodPressure, classifyVital, vitalLabel, vitalTone, worstStatus,
} from '../../lib/vitals';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, EmptyState,
  Field, Input, PageHeader, SkeletonList, TextareaField, useToast,
} from '../ui';

const EMPTY = { bp: '', glucose: '', temp: '', spo2: '', notes: '' };

/** Campo de sinal vital com selo de faixa de referência ao vivo. */
function VitalField({ label, icon: Icon, iconColor, status, hint, ...inputProps }) {
  const id = useId();
  return (
    <Field
      htmlFor={id}
      label={
        <>
          <Icon size={14} color={iconColor} aria-hidden="true" />
          {label}
        </>
      }
      hint={hint}
    >
      <div className="u-row u-gap-2">
        <Input id={id} className="u-grow" {...inputProps} />
        {status && (
          <Badge tone={vitalTone(status)} dot>
            {vitalLabel(status)}
          </Badge>
        )}
      </div>
    </Field>
  );
}

export default function VitalsControl() {
  const toast = useToast();

  const [residents, setResidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [vitals, setVitals] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('VitalSigns').select('*')
      .order('created_at', { ascending: false }).limit(20);
    setHistory(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('Resident').select('*').order('name');
      if (error) toast.error('Não foi possível carregar os moradores.');
      setResidents(data || []);
      await loadHistory();
      setLoading(false);
    })();
  }, [toast, loadHistory]);

  const bpStatus = classifyBloodPressure(vitals.bp);
  const glucoseStatus = classifyVital('glucose', vitals.glucose);
  const tempStatus = classifyVital('temp', vitals.temp);
  const spo2Status = classifyVital('spo2', vitals.spo2);

  const anyCritical = [bpStatus, glucoseStatus, tempStatus, spo2Status].includes('critical');

  const save = async () => {
    if (!vitals.bp && !vitals.glucose && !vitals.temp && !vitals.spo2) {
      toast.warning('Informe ao menos um sinal vital antes de salvar.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('VitalSigns').insert([{
      id: uid(),
      resident_id: selected.id,
      resident_name: selected.name,
      bp: vitals.bp,
      glucose: vitals.glucose,
      temp: vitals.temp,
      spo2: vitals.spo2,
      notes: vitals.notes,
      created_at: new Date().toISOString(),
    }]);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    setJustSaved(true);
    setVitals(EMPTY);
    loadHistory();
    setTimeout(() => {
      setJustSaved(false);
      setSelected(null);
    }, 1800);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Sinais vitais" description="Carregando…" />
        <SkeletonList count={3} />
      </div>
    );
  }

  /* ---------------- Confirmação pós-salvamento ---------------- */
  if (justSaved) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Aferição registrada"
          description={`O histórico de ${selected?.name} foi atualizado.`}
        />
      </Card>
    );
  }

  /* ---------------- Formulário de aferição ---------------- */
  if (selected) {
    return (
      <div>
        <Button
          variant="ghost" size="sm" icon={ArrowLeft}
          onClick={() => { setSelected(null); setVitals(EMPTY); }}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          Voltar à lista
        </Button>

        <PageHeader
          title={`Aferir ${selected.name}`}
          description="Os selos indicam se o valor está dentro da faixa de referência."
        />

        {anyCritical && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <Alert tone="danger" title="Valor fora da faixa esperada">
              Confira a aferição. Se confirmado, comunique a enfermagem responsável
              e registre a conduta no campo de observações.
            </Alert>
          </div>
        )}

        <Card>
          <CardBody>
            <div className="u-stack u-gap-5">
              <VitalField
                label="Pressão arterial" icon={Heart} iconColor="var(--red-500)"
                status={bpStatus} hint="Formato 120/80 · referência 90–139 / 60–89 mmHg"
                inputMode="numeric" placeholder="120/80"
                value={vitals.bp}
                onChange={(e) => setVitals((v) => ({ ...v, bp: e.target.value }))}
              />

              <VitalField
                label="Glicemia" icon={Droplets} iconColor="var(--blue-500)"
                status={glucoseStatus} hint="Referência 70–140 mg/dL"
                type="number" inputMode="numeric" placeholder="99"
                value={vitals.glucose}
                onChange={(e) => setVitals((v) => ({ ...v, glucose: e.target.value }))}
              />

              <div className="field-row">
                <VitalField
                  label="Temperatura" icon={Thermometer} iconColor="var(--amber-500)"
                  status={tempStatus} hint="Referência 35,5–37,5 °C"
                  type="number" step="0.1" inputMode="decimal" placeholder="36.5"
                  value={vitals.temp}
                  onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))}
                />

                <VitalField
                  label="Saturação (SpO₂)" icon={Wind} iconColor="var(--primary)"
                  status={spo2Status} hint="Referência 95–100%"
                  type="number" inputMode="numeric" placeholder="98"
                  value={vitals.spo2}
                  onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
                />
              </div>

              <TextareaField
                label="Observações"
                placeholder="Queixas, conduta adotada, contexto da aferição…"
                rows={3}
                value={vitals.notes}
                onChange={(e) => setVitals((v) => ({ ...v, notes: e.target.value }))}
              />

              <Button variant="primary" size="lg" block icon={Save} onClick={save} loading={saving}>
                Salvar aferição
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  /* ---------------- Lista de moradores + histórico ---------------- */
  return (
    <div>
      <PageHeader
        title="Sinais vitais"
        description="Selecione um morador para registrar uma nova aferição."
      />

      {residents.length === 0 ? (
        <Card>
          <EmptyState
            icon={Activity}
            title="Nenhum morador cadastrado"
            description="Cadastre os moradores na Central de Cadastros para começar a aferir."
          />
        </Card>
      ) : (
        <div className="list">
          {residents.map((res) => {
            const last = history.find((h) => h.resident_id === res.id);
            const status = last ? worstStatus(last) : null;
            return (
              <Card key={res.id} interactive>
                <button
                  onClick={() => setSelected(res)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <CardBody tight>
                    <div className="u-row u-gap-3">
                      <Avatar name={res.name} />
                      <div className="u-grow" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                          {res.name}
                        </div>
                        <div className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                          {last
                            ? `Última aferição em ${formatDateTime(last.created_at)}`
                            : 'Sem aferições registradas'}
                        </div>
                      </div>
                      {status && <Badge tone={vitalTone(status)} dot>{vitalLabel(status)}</Badge>}
                      <ChevronRight size={18} color="var(--text-subtle)" aria-hidden="true" />
                    </div>
                  </CardBody>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <section className="section" style={{ marginTop: 'var(--space-10)' }}>
        <div className="section__header">
          <h2 className="section__title">Últimas aferições</h2>
        </div>

        {history.length === 0 ? (
          <Card>
            <EmptyState icon={Activity} title="Nenhuma aferição registrada ainda" />
          </Card>
        ) : (
          <div className="list">
            {history.map((record) => {
              const status = worstStatus(record);
              return (
                <Card
                  key={record.id}
                  accent={status === 'critical' ? 'danger' : status === 'attention' ? 'warning' : undefined}
                >
                  <CardBody tight>
                    <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-3)' }}>
                      <strong style={{ fontSize: 'var(--text-md)' }}>
                        {record.resident_name || 'Morador'}
                      </strong>
                      <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatDateTime(record.created_at)}
                      </span>
                    </div>

                    <div className="u-row u-wrap u-gap-2">
                      {record.bp && (
                        <Badge tone={vitalTone(classifyBloodPressure(record.bp))} icon={Heart}>
                          {record.bp} mmHg
                        </Badge>
                      )}
                      {record.glucose && (
                        <Badge tone={vitalTone(classifyVital('glucose', record.glucose))} icon={Droplets}>
                          {record.glucose} mg/dL
                        </Badge>
                      )}
                      {record.temp && (
                        <Badge tone={vitalTone(classifyVital('temp', record.temp))} icon={Thermometer}>
                          {record.temp} °C
                        </Badge>
                      )}
                      {record.spo2 && (
                        <Badge tone={vitalTone(classifyVital('spo2', record.spo2))} icon={Wind}>
                          {record.spo2}%
                        </Badge>
                      )}
                    </div>

                    {record.notes && (
                      <p
                        style={{
                          marginTop: 'var(--space-3)',
                          paddingTop: 'var(--space-3)',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {record.notes}
                      </p>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
