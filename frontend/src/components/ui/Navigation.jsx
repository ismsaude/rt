
/** Controle segmentado — alternância entre poucas visões irmãs. */
export function Segmented({ value, onChange, options, block = false, className = '', ariaLabel }) {
  return (
    <div className={`segmented ${block ? 'segmented--block' : ''} ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={value === opt.value}
            className="segmented__item"
            onClick={() => onChange(opt.value)}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Abas com sublinhado — seções de uma mesma página. */
export function Tabs({ value, onChange, options, className = '', ariaLabel }) {
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={value === opt.value}
            className="tabs__item"
            onClick={() => onChange(opt.value)}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {opt.label}
            {opt.count != null && (
              <span className="badge badge--neutral" style={{ marginLeft: 2 }}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
