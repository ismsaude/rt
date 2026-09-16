
export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <header className={`page-header ${className}`}>
      <div style={{ minWidth: 0 }}>
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
