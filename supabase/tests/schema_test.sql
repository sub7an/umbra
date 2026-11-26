begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table('public', t, t || ' exists')
from unnest(array[
  'schools','staff','classes','students','enrolments','topics',
  'syllabus_map','items','item_keys','assignments','attempts','mastery'
]) as t;

select col_is_pk('public', 'attempts', 'id', 'attempts.id is pk');
select has_check('public', 'items', 'items has check constraint');
select has_column('public', 'profiles', 'progress', 'profiles.progress exists');
select col_not_null('public', 'profiles', 'progress', 'profiles.progress not null');
select col_has_default('public', 'schools', 'id', 'schools.id has default');
select col_hasnt_default('public', 'attempts', 'id', 'attempts.id has no default');
select col_is_unique('public', 'classes', 'code', 'classes.code unique');
select col_is_unique('public', 'students', 'username', 'students.username unique');
select has_index('public', 'attempts', 'attempts_student_created_idx', array['student_id','created_at'], 'attempts(student_id, created_at) indexed');
select has_index('public', 'attempts', 'attempts_assignment_idx', 'assignment_id', 'attempts(assignment_id) indexed');
select has_index('public', 'enrolments', 'enrolments_student_idx', 'student_id', 'enrolments(student_id) indexed');
select has_index('public', 'classes', 'classes_school_idx', 'school_id', 'classes(school_id) indexed');

select * from finish();
rollback;
