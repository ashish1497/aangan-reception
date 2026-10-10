import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCall } from '../../../lib/dashboardData';
import PageHeader from '../../../components/PageHeader';
import CallDetail from '../../../components/CallDetail';

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
        <Link href="/">Back to all calls</Link>
      </PageHeader>
      <main id="main" className="page">
        <CallDetail record={record} showLink={false} />
      </main>
    </>
  );
}
