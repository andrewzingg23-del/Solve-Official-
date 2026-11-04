-- SOLVE task transport. Native kernel tasks remain canonical.
-- pgmq is available in hosted Supabase Postgres but not in the PGlite
-- development/test database. Keep the core migration runnable in both.
-- Never expose this queue to browser/authenticated API roles.

do $solve$
declare
  present boolean;
begin
  if exists (select 1 from pg_available_extensions where name = 'pgmq') then
    execute 'create extension if not exists pgmq';
    execute 'select exists (select 1 from pgmq.meta where queue_name = ''solve_tasks'')' into present;
    if not present then
      execute 'select pgmq.create(''solve_tasks'')';
    end if;
    execute 'comment on table pgmq.q_solve_tasks is ''Transport only. Kernel tasks and grants are canonical; no browser access.''';
  end if;
end
$solve$;
