import { useState } from 'react';
import { Plus, Siren, Trash2 } from 'lucide-react';
import { blankIncident } from '../lib/incidents';
import {
  INCIDENT_SEVERITIES, INCIDENT_TYPES, NOTIFY_OPTIONS, severityTone,
} from '../lib/clinical';
import {
  Badge, Button, Card, CardBody, CardHeader, ChipGroup, Modal, SelectField,
  TextareaField, useConfirm, useToast,
} from './ui';

/**
 * Registro de intercorrências, compartilhado entre a passagem de
 * plantão da cuidadora e o relatório da enfermagem.
 *
 * A lista é controlada pela tela que usa o componente, porque é ela
 * que decide o momento de gravar (junto com o plantão ou o relatório).
 */
export default function IncidentsSection({ incidents, onChange, residents }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(blankIncident);

  const abrir = () => {
    setDraft(blankIncident());
    setOpen(true);
  };

  const adicionar = (e) => {
    e?.preventDefault();

    if (!draft.description.trim()) {
      toast.warning('Descreva o que aconteceu.');
      return;
    }
    if (draft.residentIds.length === 0) {
      toast.warning('Selecione ao menos um morador envolvido.');
      return;
    }
    onChange([...incidents, draft]);
    setOpen(false);
    toast.success('Intercorrência adicionada ao registro.');
  };

  const remover = async (key) => {
    const ok = await confirm({
      title: 'Remover intercorrência',
      message: 'Este registro será descartado antes do envio.',
      confirmLabel: 'Remover',
    });
    if (ok) onChange(incidents.filter((i) => i.key !== key));
  };

  return (
    <>
      <Card accent={incidents.length > 0 ? 'danger' : undefined}>
        <CardHeader
          icon={Siren}
          title="Intercorrências"
          subtitle="Quedas, agressões, crises, evasão — registre cada episódio."
          actions={
            <Button variant="secondary" size="sm" icon={Plus} onClick={abrir}>
              Registrar
            </Button>
          }
        />
        <CardBody>
          {incidents.length === 0 ? (
            <p className="u-muted" style={{ fontSize: 'var(--text-md)' }}>
              Nenhuma intercorrência neste registro. Se algo aconteceu com algum
              morador, registre aqui — assim o episódio entra no prontuário de
              cada envolvido, e não apenas no texto corrido.
            </p>
          ) : (
            <div className="u-stack u-gap-3">
              {incidents.map((inc) => (
                <div
                  key={inc.key}
                  style={{
                    padding: 'var(--space-3)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid var(--${severityTone(inc.severity) === 'danger' ? 'danger' : 'warning'})`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="u-between u-gap-3" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="u-row u-wrap u-gap-2">
                      <Badge tone={severityTone(inc.severity)} icon={Siren}>{inc.type}</Badge>
                      <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                    </div>
                    <Button
                      variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                      onClick={() => remover(inc.key)}
                      aria-label="Remover intercorrência"
                    />
                  </div>

                  <div className="u-row u-wrap u-gap-1" style={{ marginBottom: 'var(--space-2)' }}>
                    {inc.residentIds.map((id) => (
                      <Badge key={id} tone="neutral">
                        {residents.find((r) => r.id === id)?.name || 'Morador'}
                      </Badge>
                    ))}
                  </div>

                  <p style={{ fontSize: 'var(--text-md)' }}>{inc.description}</p>
                  {inc.conduct && (
                    <p className="u-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                      <strong>Conduta:</strong> {inc.conduct}
                    </p>
                  )}
                  <p className="u-subtle" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                    Comunicado a: {inc.notified.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar intercorrência"
        description="Este episódio entrará no prontuário de cada morador envolvido."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon={Siren} onClick={adicionar}>Adicionar</Button>
          </>
        }
      >
        <form onSubmit={adicionar} className="u-stack u-gap-5">
          <div className="field-row">
            <SelectField
              label="Tipo" required
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>

            <SelectField
              label="Gravidade" required
              hint={INCIDENT_SEVERITIES.find((x) => x.value === draft.severity)?.hint}
              value={draft.severity}
              onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
            >
              {INCIDENT_SEVERITIES.map((x) => <option key={x.value} value={x.value}>{x.value}</option>)}
            </SelectField>
          </div>

          <div>
            <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
              Moradores envolvidos <span className="field__required">*</span>
            </span>
            <ChipGroup
              ariaLabel="Moradores envolvidos"
              options={residents.map((r) => ({ value: r.name, tone: 'primary' }))}
              value={draft.residentIds
                .map((id) => residents.find((r) => r.id === id)?.name)
                .filter(Boolean)}
              onChange={(names) =>
                setDraft((d) => ({
                  ...d,
                  residentIds: names
                    .map((n) => residents.find((r) => r.name === n)?.id)
                    .filter(Boolean),
                }))
              }
            />
            <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
              Marque todos os que participaram, inclusive quem sofreu e quem causou.
            </span>
          </div>

          <TextareaField
            label="O que aconteceu" required
            placeholder="Descreva o episódio: onde, quando, como começou e como terminou."
            rows={4}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />

          <TextareaField
            label="Conduta adotada"
            hint="O que a equipe fez em seguida."
            placeholder="Ex.: separei os dois, conversei individualmente, apliquei medicação SOS conforme prescrição…"
            rows={3}
            value={draft.conduct}
            onChange={(e) => setDraft((d) => ({ ...d, conduct: e.target.value }))}
          />

          <div>
            <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
              Comunicado a
            </span>
            <ChipGroup
              ariaLabel="Quem foi comunicado"
              options={NOTIFY_OPTIONS}
              value={draft.notified}
              onChange={(next) => setDraft((d) => ({ ...d, notified: next }))}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
