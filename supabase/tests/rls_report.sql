-- Final report + hard assert. Runs last, after all case files, in the same session.
\set ON_ERROR_STOP on
reset role;

select name, case when passed then 'PASS' else 'FAIL' end as result, detail
from tests.results order by name;

\echo '--- SUMMARY ---'
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed,
       count(*) as total from tests.results;

do $$
declare f int;
begin
  select count(*) into f from tests.results where not passed;
  if f > 0 then raise exception '% test(s) FAILED', f; end if;
end $$;
