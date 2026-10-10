import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCall } from '../../../lib/dashboardData';
import PageHeader from '../../../components/PageHeader';
import CallDetail from '../../../components/CallDetail';
import Section from '../../../components/Section';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const r = await getCall(decodeURIComponent(params.id));
  return {
    title: r ? `${r.callerName || 'Caller'} | Aangan Voice Desk` : 'Call not found | Aangan Voice Desk',
  };
}

export default async function CallPage({ params }) {
  const record = await getCall(decodeURIComponent(params.id));
  if (!record) notFound();
  return (
    <>
      <PageHeader>
        <Link href="/" className="back-link">
          Back to all calls
        </Link>
      </PageHeader>
      <main id="main" className="wrap">
        <Section
          id="detail"
          className="row row-first"
          title="Call detail"
          note="What was said, the brief the designer gets and why it was decided that way."
        >
          <CallDetail record={record} showLink={false} />
        </Section>
      </main>
    </>
  );
}
