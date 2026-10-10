// Same grid as the dashboard so nothing shifts when the data arrives.
function Lines({ n, widths = [] }) {
  return Array.from({ length: n }, (_, i) => (
    <span key={i} className="sk-line" style={{ width: widths[i] || '100%', display: 'block' }} />
  ));
}

function Row({ children, first = false }) {
  return (
    <section className={first ? 'row row-first' : 'row'}>
      <div className="row-label">
        <Lines n={2} widths={['60%', '90%']} />
      </div>
      <div className="row-body">{children}</div>
    </section>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading the dashboard">
      <header className="page-header">
        <div className="title-block">
          <div className="memphis" aria-hidden="true" />
          <span className="sk" style={{ height: 48, width: '60%' }} />
          <span className="sk-line" style={{ width: '80%', display: 'block' }} />
        </div>
      </header>
      <hr className="header-rule" aria-hidden="true" />
      <main id="main" className="wrap">
        <Row first>
          <div className="kpis">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="kpi">
                <span className="sk-line" style={{ width: '70%', display: 'block', margin: '0 0 16px' }} />
                <span className="kpi-skel" />
              </div>
            ))}
          </div>
        </Row>
        <div className="dot-strip" aria-hidden="true" />
        <Row>
          <Lines n={6} />
        </Row>
        <Row>
          <Lines n={4} widths={['50%', '80%', '70%', '60%']} />
        </Row>
      </main>
    </div>
  );
}
