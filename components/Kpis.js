'use client';
import { useNav } from './NavProvider';

export default function Kpis({ tiles }) {
  const { pending } = useNav();
  return (
    <div className="kpis" data-testid="kpis">
      {tiles.map((t) => (
        <div key={t.key} className={`kpi kpi-${t.tone || 'black'}`} data-testid={`kpi-${t.key}`}>
          <span className="kpi-label">{t.label}</span>
          {pending ? (
            <span className="kpi-skel" aria-hidden="true" />
          ) : (
            <span className="kpi-value" data-testid={`kpi-${t.key}-value`}>
              {t.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
