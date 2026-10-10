'use client';
import Link from 'next/link';
import { Button, Empty, Table, Tag } from 'antd';
import { useNav } from './NavProvider';

function Body(props) {
  return <tbody {...props} data-testid="call-rows" />;
}

// "Rs 26.1 lakh to Rs 50.8 lakh (basis)" becomes "Rs 26.1 to 50.8 lakh".
function rangeOnly(text) {
  const plain = String(text || '').replace(/\s*\(.*\)\s*$/, '');
  const m = plain.match(/^Rs ([\d.]+) lakh to Rs ([\d.]+) lakh$/);
  return m ? `Rs ${m[1]} to ${m[2]} lakh` : plain;
}

function Trunc({ text, className = '', ...rest }) {
  return (
    <span className={`trunc ${className}`} title={text} {...rest}>
      {text}
    </span>
  );
}

export default function CallsTable({ rows, selected, linkBase }) {
  const { pending, setParams } = useNav();
  const columns = [
    {
      title: 'Time (IST)',
      dataIndex: 'time',
      key: 'time',
      width: '19%',
      render: (t, r) => (
        <>
          <Trunc text={t} />
          {r.afterHours ? <div className="small muted">after hours</div> : null}
        </>
      ),
    },
    {
      title: 'Caller',
      dataIndex: 'callerName',
      key: 'caller',
      width: '22%',
      render: (name, r) => (
        <>
          <span className="caller-line">
            <Link
              href={`${linkBase}call=${encodeURIComponent(r.id)}`}
              scroll={false}
              replace
              title={name || 'Unknown'}
            >
              {name || 'Unknown'}
            </Link>
            {r.demo ? <Tag className="pill pill-demo">Sample call</Tag> : null}
          </span>
          <Trunc text={r.phone || ''} className="small muted" />
        </>
      ),
    },
    {
      title: 'Qualification',
      dataIndex: 'qualification',
      key: 'qualification',
      width: '14%',
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
      width: '18%',
      render: (e, r) => (
        <span
          className="trunc small"
          data-testid="row-estimate"
          title={r.internalEstimate ? `${e} (internal only)` : e}
        >
          {rangeOnly(e)}
        </span>
      ),
    },
    {
      title: 'Slot',
      dataIndex: 'bookedSlot',
      key: 'slot',
      width: '14%',
      render: (s) => <Trunc text={s || '-'} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '13%',
      render: (s, r) => (
        <>
          {r.needsReview ? <Tag className="pill pill-review">needs review</Tag> : null}
          {r.needsReview && s === 'needs-review' ? '' : <Trunc text={s} />}
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
        tableLayout="fixed"
        scroll={{ x: 760 }}
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
              <Button
                className="solid-btn"
                type="primary"
                data-testid="load-samples"
                onClick={() => setParams({ samples: '1' })}
              >
                Load sample calls
              </Button>
            </Empty>
          ),
        }}
      />
    </div>
  );
}
