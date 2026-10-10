import { Card } from 'antd';
import { getDashboard } from '../lib/dashboardData';
import NavProvider from '../components/NavProvider';
import PageHeader from '../components/PageHeader';
import Controls from '../components/Controls';
import Banners from '../components/Banners';
import Kpis from '../components/Kpis';
import CallsTable from '../components/CallsTable';
import CostValue from '../components/CostValue';
import CallDetail, { EmptyDetail } from '../components/CallDetail';

export const dynamic = 'force-dynamic';

function tilesFor(s) {
  return [
    { key: 'calls', label: 'Calls answered', value: s.callsAnswered },
    { key: 'within-5-min', label: 'Answered within 5 minutes', value: s.answeredWithin5Min },
    {
      key: 'within-5-min-share',
      label: 'Share answered within 5 minutes',
      value: `${s.answeredWithin5MinShare}%`,
    },
    { key: 'qualified', label: "Worth a designer's time", value: s.qualified },
    { key: 'grey', label: 'Needs a human look', value: s.grey },
    { key: 'unqualified', label: 'Closed politely', value: s.unqualified },
    { key: 'near-miss', label: 'Near misses to double-check', value: s.nearMiss },
    { key: 'booked', label: 'Booked before the call ended', value: s.bookedOnCall },
    { key: 'after-hours-share', label: 'Calls outside 10am to 7pm', value: `${s.afterHoursShare}%` },
    { key: 'guardrail', label: 'Agent slips to review', value: s.callsNeedingReview || 0 },
  ];
}

export default async function DashboardPage({ searchParams }) {
  const { opts, stats, rows, detail } = await getDashboard(searchParams || {});
  const keep = new URLSearchParams();
  if (searchParams && searchParams.samples) keep.set('samples', String(searchParams.samples));
  if (searchParams && searchParams.count) keep.set('count', String(searchParams.count));
  const linkBase = '/?' + (keep.toString() ? keep.toString() + '&' : '');

  return (
    <NavProvider>
      <PageHeader>
        <Controls showSamples={opts.showSamples} countSamples={opts.countSamples} />
      </PageHeader>
      <main id="main" className="page">
        <Banners stats={stats} />
        <Kpis tiles={tilesFor(stats)} />
        <div className="grid">
          <div className="stack">
            <Card title={<h2 className="card-h">Calls</h2>} styles={{ body: { padding: 0 } }}>
              <CallsTable rows={rows} selected={detail ? detail.id : null} linkBase={linkBase} />
            </Card>
            <CostValue stats={stats} />
          </div>
          {detail ? <CallDetail record={detail} /> : <EmptyDetail />}
        </div>
      </main>
    </NavProvider>
  );
}
