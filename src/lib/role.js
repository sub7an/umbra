// Decides the signed-in user's role from the staff and students queries.
// Returns { role } on success, or { error } when either query failed: an error must
// never read as "no staff row", or a real teacher would be sent to school onboarding.
export function roleFromQueries(staff, student) {
  const error = staff?.error || student?.error
  if (error || !staff || !student) return { error: error || new Error('role_query_failed') }
  if (staff.data?.length) return { role: 'teacher' }
  if (student.data?.length) return { role: 'student' }
  return { role: 'public' }
}
