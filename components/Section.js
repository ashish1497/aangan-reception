// One row of the 12-column grid: a narrow label column and a wide content column.
export default function Section({ id, title, note, extra, accent, children, ...rest }) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section className="row" aria-labelledby={headingId} {...rest}>
      <div className="row-label">
        <h2 id={headingId}>{title}</h2>
        {note ? <p>{note}</p> : null}
        {accent}
        {extra ? <div className="row-extra">{extra}</div> : null}
      </div>
      <div className="row-body">{children}</div>
    </section>
  );
}
