-- solve kernel v5: erasable private content.
-- docs/plans/2026-10-04-master-bot.md ("Honest limits") and docs/plans/2026-10-04-critical-mass.md.
--
-- History stays append-only. What a person may need to erase (a memory, a private note) is stored in
-- an event encrypted with its own key, and only the key lives outside the history, in the kernel's
-- one mutable store. Destroying the key makes that content unreadable for good, while the history
-- keeps that the event happened, and that its key was destroyed, by whom and why.
--
-- Laws enforced here:
--   1. A key belongs to exactly one event and is sealed once, by the actor who recorded the event.
--   2. Reading a key needs kernel.read on the event's scope: the same gate as reading the event.
--   3. Destroying a key needs kernel.key.destroy on the event's scope (an owner holds it through
--      their own scope's '*'; a delegated agent does not unless granted). It is recorded as
--      kernel.key.destroyed, and a destroyed key can never be sealed again.
--   4. The key store holds nothing but keys and tombstones, and no API role can reach it directly.
--
-- Encryption itself happens in the application (AES-256-GCM, a random key per event). This makes
-- content erasable, not secret from the database operator; backups keep a destroyed key until they
-- expire.

create schema kernel_keys;

create table kernel_keys.event_keys (
  event_id uuid primary key references kernel.events (id),
  key text not null check (key ~ '^[A-Za-z0-9+/]{43}=$'),
  sealed_at timestamptz not null default now()
);

create table kernel_keys.destroyed_keys (
  event_id uuid primary key references kernel.events (id),
  destroyed_by uuid not null unique references kernel.events (id),
  destroyed_at timestamptz not null default now()
);

alter table kernel_keys.event_keys enable row level security;
alter table kernel_keys.destroyed_keys enable row level security;

-- Seals the key for an event the caller just recorded. Retrying with the same key is a no-op.
create function kernel_api.seal_key(p_event_id uuid, p_key text, p_as_actor uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_actor uuid;
begin
  if coalesce(p_key, '') !~ '^[A-Za-z0-9+/]{43}=$' then
    raise exception using errcode = 'KA003', message = 'a key is 32 bytes in base64';
  end if;
  select e.actor_id into v_actor from kernel.events e where e.id = p_event_id;
  if v_actor is null then
    raise exception using errcode = 'KA007', message = 'event not found';
  end if;
  if v_actor <> c.actor_id then
    raise exception using errcode = 'KA002', message = 'only the actor who recorded an event seals its key';
  end if;
  if exists (select 1 from kernel_keys.destroyed_keys d where d.event_id = p_event_id) then
    raise exception using errcode = 'KA004', message = 'this event''s key was destroyed';
  end if;
  insert into kernel_keys.event_keys (event_id, key) values (p_event_id, p_key) on conflict (event_id) do nothing;
  if not exists (select 1 from kernel_keys.event_keys k where k.event_id = p_event_id and k.key = p_key) then
    raise exception using errcode = 'KA004', message = 'this event already has a different key';
  end if;
end;
$$;

-- The keys of the given events the caller may read; destroyed or never-sealed keys are absent.
create function kernel_api.unseal_keys(p_event_ids uuid[], p_as_actor uuid default null)
returns table (event_id uuid, key text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  if p_event_ids is null or cardinality(p_event_ids) > 1000 then
    raise exception using errcode = 'KA003', message = 'ask for at most 1000 keys';
  end if;
  return query
    select k.event_id, k.key
    from kernel_keys.event_keys k
    join kernel.events e on e.id = k.event_id
    where k.event_id = any (p_event_ids)
      and kernel.find_grant(c.actor_id, 'kernel.read', e.scope) is not null
      and not kernel.event_withheld(c.actor_id, e.id, e.type, e.payload);
end;
$$;

-- Destroys an event's key for good. Destroying an already destroyed key returns the same record.
create function kernel_api.destroy_key(p_event_id uuid, p_reason text default '', p_as_actor uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text;
  v_done uuid;
  v_authority uuid;
  v_event uuid;
begin
  perform kernel.lock_chain();
  select e.scope into v_scope from kernel.events e where e.id = p_event_id;
  if v_scope is null then
    raise exception using errcode = 'KA007', message = 'event not found';
  end if;
  v_authority := kernel.require_allowed(c.actor_id, 'kernel.key.destroy', v_scope);
  select d.destroyed_by into v_done from kernel_keys.destroyed_keys d where d.event_id = p_event_id;
  if v_done is not null then
    return v_done;
  end if;
  v_event := kernel.append_event(
    c, 'kernel.key.destroyed', v_scope, v_authority,
    jsonb_build_object('event_id', p_event_id, 'reason', left(coalesce(p_reason, ''), 200))
  );
  delete from kernel_keys.event_keys k where k.event_id = p_event_id;
  insert into kernel_keys.destroyed_keys (event_id, destroyed_by) values (p_event_id, v_event);
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- Privileges: API roles reach the key store only through these kernel_api functions.
------------------------------------------------------------------------------------------------

revoke all on schema kernel_keys from public, anon, authenticated, service_role;
revoke all on all tables in schema kernel_keys from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
