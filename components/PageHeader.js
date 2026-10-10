export default function PageHeader({ children }) {
  return (
    <header className="page-header">
      <h1 data-testid="app-title">
        Aangan Voice Desk
        <span className="purpose">
          Every enquiry call answered in minutes, day or night. The right ones reach a designer with
          everything asked and a call already booked.
        </span>
      </h1>
      {children}
    </header>
  );
}
