export function SkeletonCurrentWeather() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton skeleton-text-lg" style={{ width: '40%' }} />
        <div className="skeleton skeleton-circle" style={{ width: 40, height: 40 }} />
      </div>
      <div className="skeleton-center">
        <div className="skeleton skeleton-circle" style={{ width: 80, height: 80 }} />
        <div className="skeleton skeleton-text-xl" style={{ width: 120 }} />
      </div>
      <div className="skeleton skeleton-text" style={{ width: '30%', margin: '8px auto' }} />
      <div className="skeleton skeleton-text-sm" style={{ width: '20%', margin: '4px auto 20px' }} />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-box" />
        <div className="skeleton skeleton-box" />
        <div className="skeleton skeleton-box" />
        <div className="skeleton skeleton-box" />
      </div>
    </div>
  );
}

export function SkeletonForecast() {
  return (
    <div>
      <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 14 }} />
      <div className="skeleton-grid-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card" style={{ padding: '16px 8px', animationDelay: `${i * 0.08}s` }}>
            <div className="skeleton skeleton-text-sm" style={{ width: '60%', margin: '0 auto 10px' }} />
            <div className="skeleton skeleton-circle" style={{ width: 36, height: 36, margin: '0 auto 10px' }} />
            <div className="skeleton skeleton-text" style={{ width: '50%', margin: '0 auto' }} />
            <div className="skeleton skeleton-text-sm" style={{ width: '40%', margin: '4px auto 0' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
