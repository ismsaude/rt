import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, ArrowRight } from 'lucide-react';
import {
  DEFAULT_MONTH_SECTIONS, duplicateMonth, hasContent, loadMonthSheets,
  proximoMes, SHEET_SECTIONS,
} from '../../lib/monthlyReport';
import { formatMonthLabel } from '../../lib/format';
import {
  Alert, Badge, Button, Field, Modal, MonthPicker, useToast,
} from '../ui';

/**
 * Duplica as fichas de um mês inteiro para outro, de uma vez.
 *
 * Só as seções que descrevem o morador vêm marcadas. As que descrevem o
 * período ficam de fora por padrão — levá-las adiante faria a ficha do
 * mês seguinte afirmar fatos que não aconteceram nele.
 */
export default function DuplicateMonthModal({
  open, onClose, monthKey, residents, currentUser, onDone,
}) {
  const toast = useToast();

  const [destino, setDestino] = useState(() => proximoMes(monthKey));
  const [sections, setSections] = useState(DEFAULT_MONTH_SECTIONS);
  const [comFicha, setComFicha] = useState([]);
  const [alvos, setAlvos] = useState([]);
  const [jaExistem, setJaExistem] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDestino(proximoMes(monthKey));
    setSections(DEFAULT_MONTH_SECTIONS);

    loadMonthSheets(monthKey).then(({ porMorador }) => {
      const ids = [...porMorador.entries()]
        .filter(([, row]) => hasContent(row))
        .map(([id]) => id);
      setComFicha(ids);
      setAlvos(ids);
    });
  }, [open, monthKey]);

  useEffect(() => {
    if (!open || !destino) return;
    loadMonthSheets(destino).then(({ porMorador }) => {
      const ids = new Set();
      porMorador.forEach((row, id) => { if (hasContent(row)) ids.add(id); });
      setJaExistem(ids);
    });
  }, [open, destino]);

  const nome = (id) => residents.find((r) => r.id === id)?.name || 'Morador';

  const confirmar = async () => {
    if (alvos.length === 0) {
      toast.warning('Selecione ao menos um morador.');
      return;
    }

    setSaving(true);
    const { ok, erros } = await duplicateMonth({
      fromMonth: monthKey,
      toMonth: destino,
      sections,
      residentIds: alvos,
      author: currentUser,
    });
    setSaving(false);

    if (erros.length > 0) {
      toast.error(`Falhou para ${erros.length} ficha(s): ${erros[0].mensagem}`);
      return;
    }

    toast.success(
      `${ok === 1 ? '1 ficha duplicada' : `${ok} fichas duplicadas`} para ${formatMonthLabel(destino)}. Nenhuma vem assinada — revise e assine cada uma.`
    );
    onClose();
    onDone?.(destino);
  };

  const sobrescreve = alvos.filter((id) => jaExistem.has(id)).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicar fichas para outro mês"
      description={`A partir de ${formatMonthLabel(monthKey)}.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={CalendarPlus} onClick={confirmar} loading={saving}>
            Duplicar {alvos.length > 0 && `(${alvos.length})`}
          </Button>
        </>
      }
    >
      <div className="u-stack u-gap-5">
        <div className="u-row u-gap-3 u-wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="De">
            <Badge tone="neutral" size="lg">{formatMonthLabel(monthKey)}</Badge>
          </Field>
          <ArrowRight size={18} style={{ marginBottom: 10, color: 'var(--text-subtle)' }} />
          <Field label="Para">
            <MonthPicker value={destino} onChange={setDestino} />
          </Field>
        </div>

        <Alert tone="warning" title="A assinatura não acompanha">
          As fichas chegam ao mês de destino <strong>sem assinatura</strong> e sem
          data de emissão. Um documento assinado em um mês não pode aparecer
          assinado em outro — cada ficha precisa ser revisada e assinada de novo.
        </Alert>

        <div>
          <span className="field__label" style={{ marginBottom: 'var(--space-3)' }}>
            O que levar adiante
          </span>
          <div className="u-stack u-gap-2">
            {SHEET_SECTIONS.map((s) => {
              const marcada = sections.includes(s.key);
              const doPeriodo = s.key !== 'observacoes';
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
                    onChange={() =>
                      setSections((prev) =>
                        prev.includes(s.key)
                          ? prev.filter((k) => k !== s.key)
                          : [...prev, s.key]
                      )
                    }
                  />
                  <span className="checkbox__box" aria-hidden="true">✓</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="u-row u-gap-2" style={{ flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 'var(--text-md)' }}>{s.label}</strong>
                      {doPeriodo && (
                        <Badge tone="warning" icon={AlertTriangle}>Descreve o período</Badge>
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
                      {doPeriodo
                        ? 'Relata o que aconteceu naquele mês. Copiar afirma o mesmo sobre o mês seguinte.'
                        : 'As condições do morador não mudam de um mês para o outro.'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            O nível de autonomia acompanha sempre, por ser atributo do morador.
          </span>
        </div>

        <div>
          <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
            Quais fichas
          </span>
          {comFicha.length === 0 ? (
            <p className="u-muted" style={{ fontSize: 'var(--text-md)' }}>
              Nenhuma ficha preenchida em {formatMonthLabel(monthKey)} para duplicar.
            </p>
          ) : (
            <div className="chips">
              {comFicha.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  data-tone={jaExistem.has(id) ? 'warning' : 'primary'}
                  aria-pressed={alvos.includes(id)}
                  onClick={() =>
                    setAlvos((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                >
                  {nome(id)}
                  {jaExistem.has(id) && ' ·  já existe'}
                </button>
              ))}
            </div>
          )}
        </div>

        {sobrescreve > 0 && (
          <Alert tone="danger" title={`${sobrescreve} ficha(s) já existem no destino`}>
            O conteúdo das seções escolhidas será substituído em{' '}
            {formatMonthLabel(destino)}. As demais seções permanecem como estão.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
