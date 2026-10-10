export default function PageHeader({ children }) {
  return (
    <>
      <header className="page-header">
        <div className="title-block">
          <div className="memphis" aria-hidden="true">
            <span className="m-square" />
            <span className="m-circle" />
            <span className="m-dots" />
          </div>
          <h1 data-testid="app-title">
            Aangan Voice Desk
            <span className="purpose">
              Every enquiry call answered in minutes, day or night, and the right ones handed to a designer
              with a call already booked.
            </span>
          </h1>
        </div>
        <div className="header-side">{children}</div>
      </header>
      <hr className="header-rule" aria-hidden="true" />
    </>
  );
}
