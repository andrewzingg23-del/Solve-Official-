-- SOLVE Connect, increment 1: a connected app acts as itself, with only what the person gave it.
--
-- Until now a token Supabase issued to an OAuth client (a connected assistant such as Claude or
-- ChatGPT, through /mcp) resolved to the PERSON: the kernel ignored the token's client_id, so any
-- connected app held the person's whole authority, and a leaked connector token could call every
-- kernel_api function as them, not only the connector's tools.
--
-- Now:
--   * A token carrying a client_id resolves to that app's CONNECTION AGENT — an agent actor the
--     person owns, made when they connect the app — never to the person.
--   * The agent starts with nothing. It reaches only what the person grants it, thing by thing,
--     through the kernel's ordinary grants (issue_grant / revoke_grant), with their expiry,
--     revocation and history.
--   * Disconnecting revokes every grant the agent holds and refuses the app's tokens from then on,
--     even tokens issued before, because resolution itself fails.
--   * An app that was never connected is refused everything.
--   * Only the person, in their own session, can connect or disconnect an app; an app cannot connect
--     itself or another app.
--
-- Reconciled with MCPvault (docs/research/2026-11-10-mcpvault-connect-audit.md): its per-app,
-- per-area grants with expiry and an audit log are kept as ideas; the kernel's grants, revocation
-- and hash-linked history are the mechanism. No code was taken from it.

create table kernel.connections (
  id uuid primary key,
  person_id uuid not null references kernel.actors (id),
  client_id text not null check (client_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$'),
  agent_id uuid not null unique references kernel.actors (id),
  label text not null default '' check (length(label) <= 200),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);
create index connections_person_client on kernel.connections (person_id, client_id);

create table kernel.disconnections (
  connection_id uuid primary key references kernel.connections (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['connections', 'disconnections'] loop
    execute format('alter table kernel.%I enable row level security', t);
    execute format('create trigger %I before update or delete on kernel.%I for each row execute function kernel.forbid_mutation()', t || '_append_only', t);
    execute format('create trigger %I before truncate on kernel.%I for each statement execute function kernel.forbid_mutation()', t || '_no_truncate', t);
    execute format('revoke all on kernel.%I from public, anon, authenticated, service_role', t);
  end loop;
end;
$$;

-- The person's live connection for an app, if any.
create function kernel.active_connection(p_person uuid, p_client_id text) returns kernel.connections
language sql stable set search_path = '' as $$
  select c.* from kernel.connections c
  where c.person_id = p_person and c.client_id = p_client_id
    and not exists (select 1 from kernel.disconnections d where d.connection_id = c.id)
  order by c.created_at desc limit 1;
$$;

create or replace function kernel.resolve_caller(p_as_actor uuid) returns kernel.caller
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  jwt_role text := claims ->> 'role';
  session_role text := nullif(current_setting('role', true), 'none');
  v_client text := nullif(claims ->> 'client_id', '');
  v_connection kernel.connections;
  result kernel.caller;
begin
  if session_role is not null and session_role is distinct from jwt_role then
    raise exception using errcode = 'KA001', message = 'session role does not match token role';
  end if;

  if jwt_role = 'authenticated' then
    if p_as_actor is not null then
      raise exception using errcode = 'KA002', message = 'end users act only as themselves';
    end if;
    select a.id, a.kind into result.actor_id, result.kind
    from kernel.identity_links l
    join kernel.actors a on a.id = l.actor_id
    where l.provider = 'supabase_auth' and l.subject = claims ->> 'sub';
    if result.actor_id is null then
      raise exception using errcode = 'KA001', message = 'caller is not registered; call kernel_api.register() first';
    end if;
    result.auth_method := 'user_jwt';

    -- A token issued to an app acts as that app's connection agent, never as the person.
    if v_client is not null then
      v_connection := kernel.active_connection(result.actor_id, v_client);
      if v_connection.id is null then
        raise exception using errcode = 'KA002', message = 'this app is not connected; connect it from SOLVE first';
      end if;
      result.principal_id := result.actor_id;
      result.actor_id := v_connection.agent_id;
      result.kind := 'agent';
    end if;
    return result;
  end if;

  if jwt_role = 'service_role' then
    if p_as_actor is null then
      raise exception using errcode = 'KA003', message = 'service calls must name the agent or service actor they act as';
    end if;
    if p_as_actor = kernel.kernel_actor_id() then
      raise exception using errcode = 'KA002', message = 'the kernel acts only through its own functions';
    end if;
    select a.id, a.kind, case when a.kind = 'agent' then kernel.party_of(a.id) end
    into result.actor_id, result.kind, result.principal_id
    from kernel.actors a where a.id = p_as_actor;
    if result.actor_id is null then
      raise exception using errcode = 'KA007', message = 'unknown actor';
    end if;
    if result.kind = 'human' then
      raise exception using errcode = 'KA002', message = 'the service key cannot act as a human';
    end if;
    result.auth_method := 'service_role';
    return result;
  end if;

  raise exception using errcode = 'KA001', message = 'unauthenticated';
end;
$$;

-- Connect an app. The person, in their own session, makes the app's agent; it holds nothing yet.
create function kernel_api.connect_app(p_client_id text, p_label text default '', p_idempotency_key text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(null);
  v_existing kernel.connections;
  v_agent uuid;
  v_event uuid;
  v_id uuid := gen_random_uuid();
begin
  if c.kind <> 'human' then
    raise exception using errcode = 'KA002', message = 'only a person can connect an app';
  end if;
  if p_client_id is null or p_client_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$' then
    raise exception using errcode = 'KA003', message = 'invalid app id';
  end if;
  if length(coalesce(p_label, '')) > 200 then
    raise exception using errcode = 'KA003', message = 'label is limited to 200 characters';
  end if;
  perform kernel.lock_chain();
  v_existing := kernel.active_connection(c.actor_id, p_client_id);
  if v_existing.id is not null then
    return v_existing.agent_id;
  end if;
  v_agent := kernel.do_spawn_agent(c, coalesce(nullif(p_label, ''), 'Connected app'), 'specialist', null,
    case when p_idempotency_key is null then null else 'connect-agent:' || p_idempotency_key end);
  v_event := kernel.append_event(
    c, 'kernel.app.connected', 'actor:' || c.actor_id, kernel.require_grant(c.actor_id, 'kernel.actor.create', 'actor:' || c.actor_id),
    jsonb_build_object('connection_id', v_id, 'client_id', p_client_id, 'agent_id', v_agent, 'label', coalesce(p_label, '')),
    null, p_idempotency_key
  );
  insert into kernel.connections (id, person_id, client_id, agent_id, label, event_id)
  values (v_id, c.actor_id, p_client_id, v_agent, coalesce(p_label, ''), v_event);
  return v_agent;
end;
$$;

-- Disconnect an app: every grant its agent holds is revoked, and its tokens stop resolving.
create function kernel_api.disconnect_app(p_client_id text, p_idempotency_key text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(null);
  v_connection kernel.connections;
  v_event uuid;
  g record;
  r uuid;
begin
  if c.kind <> 'human' then
    raise exception using errcode = 'KA002', message = 'only a person can disconnect an app';
  end if;
  perform kernel.lock_chain();
  v_connection := kernel.active_connection(c.actor_id, p_client_id);
  if v_connection.id is null then
    return; -- already disconnected, or never connected: the outcome the person asked for holds.
  end if;
  for g in
    select gr.id, gr.scope from kernel.grants gr
    where gr.grantee_id = v_connection.agent_id
      and not exists (select 1 from kernel.grant_revocations x where x.grant_id = gr.id)
  loop
    r := kernel.append_event(
      c, 'kernel.grant.revoked', case when g.scope = '*' then 'system' else g.scope end, null,
      jsonb_build_object('grant_id', g.id, 'basis', 'disconnect', 'reason', 'App disconnected'), null, null
    );
    insert into kernel.grant_revocations (grant_id, revoked_by, event_id) values (g.id, c.actor_id, r);
  end loop;
  v_event := kernel.append_event(
    c, 'kernel.app.disconnected', 'actor:' || c.actor_id, kernel.require_grant(c.actor_id, 'kernel.actor.create', 'actor:' || c.actor_id),
    jsonb_build_object('connection_id', v_connection.id, 'client_id', p_client_id, 'agent_id', v_connection.agent_id),
    null, p_idempotency_key
  );
  insert into kernel.disconnections (connection_id, event_id) values (v_connection.id, v_event);
end;
$$;

-- The person's connected apps, live and past, and what each can reach right now.
create function kernel_api.my_connections()
returns table (client_id text, label text, agent_id uuid, connected_at timestamptz, disconnected_at timestamptz, scopes jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(null);
begin
  if c.kind <> 'human' then
    raise exception using errcode = 'KA002', message = 'only a person can list their connected apps';
  end if;
  return query
    select cn.client_id, cn.label, cn.agent_id, cn.created_at, d.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('scope', g.scope, 'capability', g.capability, 'grant_id', g.id) order by g.scope, g.capability)
        from kernel.grants g where g.grantee_id = cn.agent_id and kernel.grant_is_active(g.id)), '[]'::jsonb)
    from kernel.connections cn
    left join kernel.disconnections d on d.connection_id = cn.id
    where cn.person_id = c.actor_id
    order by cn.created_at desc;
end;
$$;

revoke all on function kernel.active_connection(uuid, text) from public, anon, authenticated, service_role;
revoke all on function kernel_api.connect_app(text, text, text) from public, anon;
revoke all on function kernel_api.disconnect_app(text, text) from public, anon;
revoke all on function kernel_api.my_connections() from public, anon;
grant execute on function kernel_api.connect_app(text, text, text) to authenticated;
grant execute on function kernel_api.disconnect_app(text, text) to authenticated;
grant execute on function kernel_api.my_connections() to authenticated;
