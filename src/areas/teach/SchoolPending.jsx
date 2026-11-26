// Shown to staff while their school waits for approval (schools.plan = 'pending').
// Classes can be set up meanwhile; students can't join and cards can't be issued yet.
export default function SchoolPending() {
  return (
    <section className="cr-panel cr-panel--accent" role="status" aria-labelledby="school-pending-title" data-testid="school-pending">
      <h2 id="school-pending-title">Your school is awaiting approval</h2>
      <p style={{ margin: 0 }}>
        We'll email you when it's ready. You can set up classes meanwhile; students can join
        and you can issue login cards once the school is approved.
      </p>
    </section>
  )
}
