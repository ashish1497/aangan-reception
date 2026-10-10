import { Alert } from 'antd';

export default function Banners({ stats }) {
  const notes = [];
  if (stats.storage === 'memory')
    notes.push({
      key: 'mem',
      type: 'warning',
      text: 'Calls are held in memory and will reset when the server restarts.',
    });
  if (stats.includesDemo)
    notes.push({ key: 'demo', type: 'info', text: 'The numbers include sample calls.' });
  if (stats.callsNeedingReview)
    notes.push({
      key: 'guard',
      type: 'error',
      text: `${stats.callsNeedingReview} ${
        stats.callsNeedingReview === 1 ? 'call needs' : 'calls need'
      } review: the agent said something it should not have.`,
    });
  return (
    <div id="banners" className="banners" aria-live="polite">
      {notes.map((n) => (
        <Alert key={n.key} type={n.type} message={n.text} showIcon={false} />
      ))}
    </div>
  );
}
