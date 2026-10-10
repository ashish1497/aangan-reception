import { getDashboard } from '../lib/dashboardData';
import NavProvider from '../components/NavProvider';
import PageHeader from '../components/PageHeader';
import Controls from '../components/Controls';
import Banners from '../components/Banners';
import Kpis from '../components/Kpis';
import CallsTable from '../components/CallsTable';
import CostValue from '../components/CostValue';
import CallDetail, { EmptyDetail } from '../components/CallDetail';
import Section from '../components/Section';

export const dynamic = 'force-dynamic';

// Tone sets the KPI top rule: black for counts, blue for neutral shares, red for review, yellow for near misses.
function tilesFor(s) {
  return [
    { key: 'calls', label: 'Calls answered', value: s.callsAnswered },
    { key: 'within-5-min', label: 'Answered within 5 minutes', value: s.answeredWithin5Min },
    {
      key: 'within-5-min-share',
      label: 'Share answered within 5 minutes',
      value: `${s.answeredWithin5MinShare}%`,
      tone: 'blue',
    },
    { key: 'qualified', label: "Worth a designer's time", value: s.qualified },
    { key: 'grey', label: 'Needs a human look', value: s.grey, tone: 'red' },
    { key: 'unqualified', label: 'Closed politely', value: s.unqualified },
    { key: 'near-miss', label: 'Near misses to double-check', value: s.nearMiss, tone: 'yellow' },
    { key: 'booked', label: 'Booked before the call ended', value: s.bookedOnCall },
    {
      key: 'after-hours-share',
      label: 'Calls outside 10am to 7pm',
      value: `${s.afterHoursShare}%`,
      tone: 'blue',
    },
    { key: 'guardrail', label: 'Agent slips to review', value: s.callsNeedingReview || 0, tone: 'red' },
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
      <main id="main" className="wrap">
        <Banners stats={stats} />
        <Section
          id="kpis"
          className="row row-first"
          title="Key numbers"
          note="How the desk is doing across every answered call."
          accent={<span className="m-half" aria-hidden="true" />}
        >
          <Kpis tiles={tilesFor(stats)} />
        </Section>
        <div className="dot-strip" aria-hidden="true" />
        <Section id="calls" title="Calls" note="Pick a row to open the call below.">
          <CallsTable rows={rows} selected={detail ? detail.id : null} linkBase={linkBase} />
        </Section>
        <Section
          id="detail"
          title="Call detail"
          note="What was said, the brief the designer gets and why it was decided that way."
        >
          {detail ? <CallDetail record={detail} /> : <EmptyDetail />}
        </Section>
        <CostValue stats={stats} />
      </main>
    </NavProvider>
  );
}
