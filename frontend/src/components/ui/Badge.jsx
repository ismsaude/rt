
/** tone: neutral | primary | success | warning | danger | info */
export default function Badge({ tone = 'neutral', size, dot = false, icon: Icon, className = '', children }) {
  const classes = ['badge', `badge--${tone}`, size === 'lg' && 'badge--lg', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
