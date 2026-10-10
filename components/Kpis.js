'use client';
import { Card, Skeleton, Statistic } from 'antd';
import { useNav } from './NavProvider';

export default function Kpis({ tiles }) {
  const { pending } = useNav();
  return (
    <section className="kpis" data-testid="kpis" aria-label="Key numbers">
      {tiles.map((t) => (
        <Card key={t.key} size="small" data-testid={`kpi-${t.key}`}>
          <Statistic
            title={t.label}
            value={t.value}
            valueRender={(node) =>
              pending ? (
                <Skeleton.Input active size="small" style={{ width: 56 }} />
              ) : (
                <span data-testid={`kpi-${t.key}-value`}>{node}</span>
              )
            }
          />
        </Card>
      ))}
    </section>
  );
}
