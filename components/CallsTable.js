'use client';
import Link from 'next/link';
import { Button, Empty, Table, Tag } from 'antd';
import { useNav } from './NavProvider';

function Body(props) {
  return <tbody {...props} data-testid="call-rows" />;
}

export default function CallsTable({ rows, selected, linkBase }) {
  const { pending, setParams } = useNav();
  const columns = [
    {
      title: 'Time (IST)',
      dataIndex: 'time',
      key: 'time',
      render: (t, r) => (
        <>
          {t}
          {r.afterHours ? <div className="small muted">after hours</div> : null}
        </>
      ),
    },
    {
      title: 'Caller',
      dataIndex: 'callerName',
      key: 'caller',
      render: (name, r) => (
        <>
          <Link href={`${linkBase}call=${encodeURIComponent(r.id)}`} scroll={false} replace>
            {name || 'Unknown'}
          </Link>{' '}
          {r.demo ? <Tag className="pill pill-demo">Sample call</Tag> : null}
          <div className="small muted">{r.phone || ''}</div>
        </>
      ),
    },
    {
      title: 'Qualification',
      dataIndex: 'qualification',
      key: 'qualification',
      render: (q) => (
        <Tag className={`pill pill-${q}`} data-testid="row-qualification">
          {q}
        </Tag>
      ),
    },
    {
      title: 'Internal estimate',
      dataIndex: 'estimateShort',
      key: 'estimate',
      render: (e, r) => (
        <span className="small" data-testid="row-estimate">
          {e}
          {r.internalEstimate ? <span className="muted"> (internal only)</span> : null}
        </span>
      ),
    },
    { title: 'Slot', dataIndex: 'bookedSlot', key: 'slot', render: (s) => s || '-' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s, r) => (
        <>
          {r.needsReview ? <Tag className="pill pill-unqualified">needs review</Tag> : null}
          {r.needsReview && s === 'needs-review' ? '' : s}
        </>
      ),
    },
  ];

  return (
    <div className="table-scroll">
      <Table
        className="calls-table"
        aria-label="Calls"
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
        loading={pending}
        components={{ body: { wrapper: Body } }}
        rowClassName={(r) => (r.id === selected ? 'selected' : '')}
        onRow={(r) => ({
          'data-testid': 'call-row',
          'data-id': r.id,
          onClick: (e) => {
            if (e.target.closest && e.target.closest('a')) return;
            setParams({ call: r.id });
          },
        })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No calls yet. A call shows up here seconds after it ends."
            >
              <Button type="primary" data-testid="load-samples" onClick={() => setParams({ samples: '1' })}>
                Load sample calls
              </Button>
            </Empty>
          ),
        }}
      />
    </div>
  );
}
