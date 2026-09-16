
function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

export default function Avatar({ name, size = 'md', className = '' }) {
  return (
    <span className={`avatar avatar--${size} ${className}`} aria-hidden="true" title={name}>
      {initials(name)}
    </span>
  );
}
