-- Private, content-free World change notifications. Kernel events remain the source of truth.
-- Each signed-in person has one private Realtime topic; the trigger sends only to humans whose
-- kernel grants currently permit reading the event's World.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    execute $policy$
      drop policy if exists "world live sync: receive own notifications" on realtime.messages
    $policy$;
    execute $policy$
      create policy "world live sync: receive own notifications" on realtime.messages
      for select to authenticated
      using (
        realtime.topic() = 'world-live:' || (select auth.uid())::text
        and realtime.messages.extension = 'broadcast'
      )
    $policy$;

    execute $function$
      create or replace function kernel.broadcast_world_event() returns trigger
      language plpgsql security definer set search_path = '' as $body$
      declare
        recipient record;
        live_world_id uuid;
      begin
        if new.scope !~* '^world:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return new;
        end if;
        live_world_id := substring(new.scope from 7)::uuid;

        for recipient in
          select distinct l.subject
          from kernel.identity_links l
          join kernel.actors a on a.id = l.actor_id
          where l.provider = 'supabase_auth'
            and a.kind = 'human'
            and l.subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and kernel.find_grant(l.actor_id, 'kernel.read', new.scope) is not null
        loop
          begin
            perform realtime.send(
              jsonb_build_object('world_id', live_world_id::text, 'seq', new.seq),
              'world.changed',
              'world-live:' || recipient.subject::uuid::text,
              true
            );
          exception when others then
            -- Realtime is a best-effort invalidation path. Durable kernel writes still commit;
            -- clients refresh from the kernel after the channel reconnects.
            raise warning 'World live notification failed for event sequence %', new.seq;
          end;
        end loop;

        return new;
      end;
      $body$
    $function$;
    execute 'revoke all on function kernel.broadcast_world_event() from public, anon, authenticated, service_role';
    execute 'drop trigger if exists kernel_events_live_broadcast on kernel.events';
    execute 'create trigger kernel_events_live_broadcast after insert on kernel.events for each row execute function kernel.broadcast_world_event()';
  end if;
end;
$$;
