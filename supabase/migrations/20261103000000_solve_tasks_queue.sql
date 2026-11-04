-- SOLVE durable task delivery outbox (Phase 1).
-- Human authority, task state and evidence remain in the kernel.
-- The queue is deliberately *not* reachable by anon/authenticated browser clients.
-- A trusted worker and narrowly scoped PostgreSQL grants are required before dispatch.
-- This migration is safe if the queue was already provisioned during the staging probe.

create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1 from pgmq.meta where queue_name = 'solve_tasks'
  ) then
    perform pgmq.create('solve_tasks');
  end if;
end $$;

comment on table pgmq.q_solve_tasks is
  'Transport only. SOLVE kernel tasks and grants are canonical; no direct browser access.';
