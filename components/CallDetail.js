import Link from 'next/link';
import { Descriptions, Tag } from 'antd';
import { ist } from '../lib/dashboardData';

const SEVERITY = { violation: 'pill-review', warning: 'pill-grey' };

export function EmptyDetail() {
  return (
    <div data-testid="call-detail" className="detail">
      <p className="detail-empty">
        Pick a call to see what was said, the brief the designer gets and why it was decided that way.
      </p>
    </div>
  );
}

export default function CallDetail({ record: r, showLink = true }) {
  const f = r.fields || {};
  const n = r.notification || {};
  const guards = (r.guardrails && r.guardrails.flags) || [];
  const q = r.qualification || { status: 'unknown', reasons: [] };
  const items = [
    { key: 'caller', label: 'Caller', children: `${r.callerName || 'Unknown'} ${r.phone || ''}` },
    {
      key: 'started',
      label: 'Started',
      children: `${ist(r.startedAt)}, ${Math.round(((r.durationSec || 0) / 60) * 10) / 10} min`,
    },
    {
      key: 'q',
      label: 'Qualification',
      children: (
        <span data-testid="detail-qualification">
          <Tag className={`pill pill-${q.status}`}>{q.status}</Tag>
        </span>
      ),
    },
    {
      key: 'space',
      label: 'Space',
      children: [
        f.projectType || '?',
        f.areaSqft ? f.areaSqft + ' sq ft' : 'area unknown',
        [f.locality, f.city].filter(Boolean).join(', ') || 'location unknown',
      ].join(', '),
    },
    {
      key: 'budget',
      label: 'Budget / timeline',
      children: `${f.budgetText || 'not stated'} / ${f.timeline || 'not stated'}`,
    },
    {
      key: 'estimate',
      label: 'Internal estimate',
      children: (
        <span data-testid="detail-estimate">
          {r.internalEstimate
            ? r.internalEstimate.label
            : 'Internal estimate, never quoted to the client: not computed'}
        </span>
      ),
    },
    ...(q.nextQuestion
      ? [
          {
            key: 'next',
            label: 'Ask the caller',
            children: <span data-testid="detail-next-question">{q.nextQuestion}</span>,
          },
        ]
      : []),
    { key: 'slot', label: 'Slot', children: r.bookedSlot || 'none booked' },
    {
      key: 'notify',
      label: 'Notification',
      children:
        (n.channel || 'none') +
        ': ' +
        (n.status || '-') +
        (n.audience ? ' to ' + n.audience : '') +
        (n.detail ? ' (' + n.detail + ')' : ''),
    },
    {
      key: 'rec',
      label: 'Recording',
      children: r.recordingUrl ? (
        <a href={r.recordingUrl} target="_blank" rel="noopener noreferrer">
          Open recording
        </a>
      ) : (
        'not provided'
      ),
    },
    { key: 'extraction', label: 'Extraction', children: String(r.extraction || '') },
  ];

  return (
    <div className="detail" data-testid="call-detail" data-loaded="true">
      <div className="detail-head">
        <p className="detail-name">
          {r.callerName || 'Unknown caller'}{' '}
          {r.demo ? <Tag className="pill pill-demo">Sample call</Tag> : null}
        </p>
        {showLink ? (
          <Link href={`/calls/${encodeURIComponent(r.id)}`} prefetch={false}>
            Open full page
          </Link>
        ) : null}
      </div>
      <Descriptions className="kv" column={1} size="small" items={items} />
      <p className="note">
        Estimates are for the designer only. The agent never quotes a price; pricing is covered at the
        consultation.
      </p>
      <h3>Designer brief</h3>
      <pre data-testid="detail-brief">{r.brief}</pre>
      <h3>Reasons</h3>
      <ul data-testid="detail-reasons">
        {(q.reasons || []).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
      {(q.notes || []).length ? (
        <>
          <h3>Handoff notes</h3>
          <ul data-testid="detail-notes">
            {q.notes.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Guardrail flags</h3>
      <div data-testid="detail-guardrails">
        {guards.length ? (
          <ul>
            {guards.map((g, i) => (
              <li key={i}>
                <Tag className={`pill ${SEVERITY[g.severity] || 'pill-demo'}`}>{g.severity}</Tag> {g.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No flags on this call.</p>
        )}
      </div>
      <h3>Transcript</h3>
      <div className="tx" data-testid="detail-transcript">
        {(r.transcript || []).length ? (
          r.transcript.map((l, i) => (
            <p key={i}>
              <b>{l.speaker}:</b> {l.text}
            </p>
          ))
        ) : (
          <p className="muted">No transcript</p>
        )}
      </div>
    </div>
  );
}
