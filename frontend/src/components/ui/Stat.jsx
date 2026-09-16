import { Card } from './Card';

/** tone: default | success | warning | danger */
export function Stat({ label, value, hint, icon: Icon, tone = 'default' }) {
  return (
    <Card>
      <div className="stat">
        <span className="stat__label">
          {Icon && <Icon size={14} aria-hidden="true" />}
          {label}
        </span>
        <span className={`stat__value ${tone !== 'default' ? `stat__value--${tone}` : ''}`}>{value}</span>
        {hint && <span className="stat__hint">{hint}</span>}
      </div>
    </Card>
  );
}

export function StatGrid({ children, className = '' }) {
  return <div className={`stat-grid ${className}`}>{children}</div>;
}
