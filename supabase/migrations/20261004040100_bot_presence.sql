-- Live presence for the master bot: while a connected assistant uses the connector, the server
-- broadcasts "who is doing what" (never memory contents) on a private Realtime channel that only
-- the bot's owner may receive. Nothing is stored. This touches Supabase Realtime's authorization
-- only, not the kernel, and is skipped where Realtime does not exist (the embedded test kernel).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    execute $policy$
      create policy "bot presence: owners receive their own" on realtime.messages
      for select to authenticated
      using (realtime.topic() = 'bot-live:' || (select auth.uid())::text and realtime.messages.extension = 'broadcast')
    $policy$;
  end if;
end;
$$;
