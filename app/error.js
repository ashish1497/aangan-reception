'use client';
import { Button, Result } from 'antd';

export default function Error({ reset }) {
  return (
    <main id="main" className="page">
      <Result
        status="warning"
        title="The dashboard could not load just now"
        subTitle="The call data did not come back in time. Try again in a moment."
        extra={
          <Button type="primary" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
