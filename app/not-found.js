import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="wrap">
      <section className="row row-first message">
        <div className="row-label">
          <div className="memphis" aria-hidden="true">
            <span className="m-square" />
            <span className="m-circle" />
          </div>
        </div>
        <div className="row-body">
          <h1>Call not found</h1>
          <p>
            This call is not in the list any more. <Link href="/">Back to all calls</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
