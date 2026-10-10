'use client';
import { Button } from 'antd';

export default function Error({ reset }) {
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
          <h1>The dashboard could not load just now</h1>
          <p>The call data did not come back in time. Try again in a moment.</p>
          <Button className="solid-btn" type="primary" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </section>
    </main>
  );
}
