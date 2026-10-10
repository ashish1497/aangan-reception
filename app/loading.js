import { Card, Skeleton } from 'antd';
import SkeletonInput from '../components/SkeletonInput';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading the dashboard">
      <header className="page-header">
        <Skeleton active title={{ width: 240 }} paragraph={{ rows: 1, width: 420 }} />
      </header>
      <main id="main" className="page">
        <section className="kpis">
          {Array.from({ length: 10 }, (_, i) => (
            <Card key={i} size="small">
              <Skeleton active title={false} paragraph={{ rows: 2, width: ['70%', '40%'] }} />
            </Card>
          ))}
        </section>
        <div className="grid">
          <div className="stack">
            <Card title={<SkeletonInput active size="small" />}>
              <Skeleton active title={false} paragraph={{ rows: 6 }} />
            </Card>
            <Card>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </div>
          <Card>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </div>
      </main>
    </div>
  );
}
