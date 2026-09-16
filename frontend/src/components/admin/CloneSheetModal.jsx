import { useEffect, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import {
  cloneSheet, DEFAULT_CLONE_SECTIONS, hasContent, loadMonthSheets, SHEET_SECTIONS,
} from '../../lib/monthlyReport';
import { formatMonthLabel } from '../../lib/format';
import {
  Alert, Badge, Button, Modal, useToast,
} from '../ui';

/**
 * Copia seções da ficha atual para outros moradores do mesmo mês.
 *
 * As seções individuais vêm desmarcadas: repetir "moradora com joelho
 * em geno valgo" no prontuário de outra pessoa insere informação falsa.
 */
export default function CloneSheetModal({
  open, onClose, origem, monthKey, resident, residents, currentUser, onDone,
}) {
  const toast = useToast();

  const [sections, setSections] = useState(DEFAULT_CLONE_SECTIONS);
  const [alvos, setAlvos] = useState([]);
  const [comConteudo, setComConteudo] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const candidatos = residents.filter((r) => r.id !== resident?.id);

  useEffect(() => {
    if (!open) return;
    setSections(DEFAULT_CLONE_SECTIONS);
    setAlvos([]);

    loadMonthSheets(monthKey).then(({ porMorador }) => {
      const ids = new Set();
      porMorador.forEach((row, id) => { if (hasContent(row)) ids.add(id); });
      setComConteudo(ids);
    });
  }, [open, monthKey]);

  const toggleSection = (key) =>
    setSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const toggleAlvo = (id) =>
    setAlvos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirmar = async () => {
    if (sections.length === 0) {
      toast.warning('Escolha ao menos uma seção para copiar.');
      return;
    }
    if (alvos.length === 0) {
      toast.warning('Escolha ao menos um morador de destino.');
      return;
    }

    setSaving(true);
    const { ok, erros } = await cloneSheet({
      origem,
      sections,
      destinos: candidatos.filter((r) => alvos.includes(r.id)),
      monthKey,
      author: currentUser,
    });
    setSaving(false);

    if (erros.length > 0) {
      toast.error(`Falhou para ${erros.length} morador(es): ${erros[0].mensagem}`);
      return;
    }

    toast.success(
      `Ficha copiada para ${ok === 1 ? '1 morador' : `${ok} moradores`}. Revise cada uma antes de emitir.`
    );
    onClose();
    onDone?.();
  };

  const sobrescreve = alvos.filter((id) => comConteudo.has(id)).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copiar ficha para outros moradores"
      description={`Seções de ${resident?.name} em ${formatMonthLabel(monthKey)}.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Copy} onClick={confirmar} loading={saving}>
            Copiar
          </Button>
        </>
      }
    >
      <div className="u-stack u-gap-5">
        <Alert tone="warning" title="Revise depois de copiar">
          Ficha é prontuário. O que descreve uma pessoa — comportamento, adesão e
          autonomia — não vale para outra, e duas fichas idênticas chamam atenção
          numa auditoria. Por isso essas seções vêm desmarcadas.
        </Alert>

        <div>
          <span className="field__label" style={{ marginBottom: 'var(--space-3)' }}>
            O que copiar
          </span>
          <div className="u-stack u-gap-2">
            {SHEET_SECTIONS.map((s) => {
              const marcada = sections.includes(s.key);
              return (
                <label
                  key={s.key}
                  className="checkbox"
                  style={{
                    padding: 'var(--space-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: marcada ? 'var(--primary-subtle)' : 'var(--surface)',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => toggleSection(s.key)}
                  />
                  <span className="checkbox__box" aria-hidden="true">✓</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="u-row u-gap-2" style={{ flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 'var(--text-md)' }}>{s.label}</strong>
                      {s.individual && (
                        <Badge tone="warning" icon={AlertTriangle}>Individual</Badge>
                      )}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}
                    >
                      {s.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
            Para quem
          </span>
          <div className="chips">
            {candidatos.map((r) => {
              const marcado = alvos.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  className="chip"
                  data-tone={comConteudo.has(r.id) ? 'warning' : 'primary'}
                  aria-pressed={marcado}
                  onClick={() => toggleAlvo(r.id)}
                >
                  {r.name}
                  {comConteudo.has(r.id) && ' ·  já preenchida'}
                </button>
              );
            })}
          </div>
          <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            Moradores marcados em âmbar já têm ficha preenchida neste mês.
          </span>
        </div>

        {sobrescreve > 0 && (
          <Alert tone="danger" title={`${sobrescreve} ficha(s) serão sobrescritas`}>
            O conteúdo atual das seções escolhidas será substituído nesses
            moradores. As seções não marcadas permanecem como estão.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
