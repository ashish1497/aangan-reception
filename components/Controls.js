'use client';
import { Button, Switch } from 'antd';
import { useNav } from './NavProvider';

export default function Controls({ showSamples, countSamples }) {
  const { pending, setParams, refresh } = useNav();
  return (
    <div className="controls" aria-busy={pending}>
      <span className="controls-item">
        <Switch
          size="small"
          checked={showSamples}
          aria-label="Show sample calls"
          data-testid="toggle-show-demo"
          onChange={(v) => setParams({ samples: v ? '1' : '0', call: null })}
        />
        <span aria-hidden="true">Show sample calls</span>
      </span>
      <span className="controls-item">
        <Switch
          size="small"
          checked={countSamples}
          aria-label="Count sample calls in the numbers"
          data-testid="toggle-count-demo"
          onChange={(v) => setParams({ count: v ? '1' : null })}
        />
        <span aria-hidden="true">Count sample calls in the numbers</span>
      </span>
      <Button data-testid="refresh" onClick={refresh} loading={pending}>
        Refresh
      </Button>
    </div>
  );
}
