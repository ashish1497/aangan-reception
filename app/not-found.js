import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="page">
      <h1>Call not found</h1>
      <p>
        This call is not in the list any more. <Link href="/">Back to all calls</Link>
      </p>
    </main>
  );
}
