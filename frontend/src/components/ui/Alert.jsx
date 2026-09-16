import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/** tone: info | success | warning | danger */
export default function Alert({ tone = 'info', title, icon, className = '', children }) {
  const Icon = icon || ICONS[tone];
  return (
    <div className={`alert alert--${tone} ${className}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} className="alert__icon" aria-hidden="true" />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
