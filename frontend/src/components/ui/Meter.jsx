
/**
 * Barra de proporção. Aceita um valor único ou vários segmentos
 * empilhados — usada para resumir um mês inteiro de plantões.
 */
export function Meter({ label, value, total, tone = 'primary', hint }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">{label}</span>
        <span className="meter__value">
          {value} de {total} · {pct}%
        </span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function StackedMeter({ label, segments, total }) {
  return (
    <div className="meter">
      {label && (
        <div className="meter__head">
          <span className="meter__label">{label}</span>
          <span className="meter__value">{total} registros</span>
        </div>
      )}
      <div className="meter__track meter__track--stacked">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              className={`meter__fill meter__fill--${s.tone}`}
              style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
      </div>
      <div className="u-row u-wrap u-gap-4" style={{ marginTop: 'var(--space-1)' }}>
        {segments.map((s) => (
          <span
            key={s.label}
            className="u-row u-gap-2"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
          >
            <span
              className="badge__dot"
              style={{ background: `var(--${s.tone === 'neutral' ? 'gray-400' : s.tone})` }}
              aria-hidden="true"
            />
            {s.label} · <strong style={{ color: 'var(--text)' }}>{s.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
