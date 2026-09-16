
export function Skeleton({ width, height, circle = false, className = '', style }) {
  return (
    <div
      className={`skeleton ${circle ? 'skeleton--circle' : ''} ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Bloco de linhas para simular texto enquanto carrega. */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton--text"
          style={{ width: i === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Placeholder de lista de cards. */
export function SkeletonList({ count = 3 }) {
  return (
    <div className="list" aria-busy="true" aria-live="polite">
      <span className="u-sr-only">Carregando…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="card__body">
            <Skeleton height={15} width="38%" />
            <div style={{ height: 12 }} />
            <SkeletonText lines={2} />
          </div>
        </div>
      ))}
    </div>
  );
}
