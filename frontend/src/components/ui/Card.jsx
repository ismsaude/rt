
/**
 * Contêiner de conteúdo.
 * accent desenha a faixa de status na borda esquerda:
 * primary | success | warning | danger | info
 */
export function Card({ accent, interactive = false, flat = false, raised = false, className = '', children, ...rest }) {
  const classes = [
    'card',
    flat && 'card--flat',
    raised && 'card--raised',
    interactive && 'card--interactive',
    accent && 'card--accent',
    accent && `card--accent-${accent}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className = '', children }) {
  if (children) return <div className={`card__header ${className}`}>{children}</div>;
  return (
    <div className={`card__header ${className}`}>
      <div style={{ minWidth: 0 }}>
        <div className="card__title">
          {Icon && <Icon size={16} aria-hidden="true" />}
          {title}
        </div>
        {subtitle && <div className="card__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="u-row u-gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ tight = false, flush = false, className = '', children, ...rest }) {
  const classes = [
    'card__body',
    tight && 'card__body--tight',
    flush && 'card__body--flush',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children }) {
  return <div className={`card__footer ${className}`}>{children}</div>;
}
