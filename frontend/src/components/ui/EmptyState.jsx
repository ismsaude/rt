import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={`empty ${className}`}>
      <div className="empty__icon">
        <Icon size={24} aria-hidden="true" />
      </div>
      {title && <p className="empty__title">{title}</p>}
      {description && <p className="empty__description">{description}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
