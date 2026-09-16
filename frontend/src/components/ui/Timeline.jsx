
/** tone: default | warning | danger */
export function Timeline({ children, className = '' }) {
  return <div className={`timeline ${className}`}>{children}</div>;
}

export function TimelineItem({ date, meta, tone = 'default', isLast = false, children }) {
  return (
    <div className="timeline__item">
      <div className="timeline__rail">
        <span
          className={`timeline__marker ${tone !== 'default' ? `timeline__marker--${tone}` : ''}`}
          aria-hidden="true"
        />
        {!isLast && <span className="timeline__line" aria-hidden="true" />}
      </div>
      <div className="timeline__content">
        <div className="timeline__meta">
          <span className="timeline__date">{date}</span>
          {meta}
        </div>
        <div className="timeline__text">{children}</div>
      </div>
    </div>
  );
}
