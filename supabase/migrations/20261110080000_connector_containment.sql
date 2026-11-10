-- Containment for connected apps that predate SOLVE Connect (security gate, 2026-11-10).
--
-- 20261110070000 gives apps connected the new way their own agent with only what the person
-- granted. Existing connections — the MCP connector's "speak as my bot" — read the person's persona,
-- memories and things through the token as though it were the person, so switching them to agents
-- in one step would cut those reads off. Until they move, this contains them:
--
--   * READ-ONLY. A token issued to an app that was never connected the new way still resolves to the
--     person, but can change nothing: every change in the kernel is an appended event, and
--     append_event refuses any caller marked app_read_only. It cannot write, grant, invite, accept,
--     publish, label, connect apps — anything that appends.
--   * IMMEDIATE REVOCATION. When the person disconnects an app, Supabase deletes that app's sessions.
--     An access token already issued would otherwise keep working until it expires; the kernel now
--     refuses any app token whose session no longer exists, so a disconnect takes effect at once.
--   * DISCONNECTED STAYS DISCONNECTED. An app disconnected through disconnect_app is refused outright.
--
-- What this does NOT contain, stated plainly: an old-style app token can still READ what the person
-- can read, until that connection moves onto its own agent (the next Connect slice).
-- The person's own sessions (no client_id) are untouched.

create or replace function kernel.app_session_alive(p_session_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_alive boolean;
begin
  -- Where Supabase Auth is present, the token's session must still exist. (The embedded test
  -- database has no auth schema; tests create one to exercise this.)
  if to_regclass('auth.sessions') is null then return true; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  execute 'select exists (select 1 from auth.sessions where id = $1::uuid)' into v_alive using p_session_id;
  return v_alive;
end;
$$;
revoke all on function kernel.app_session_alive(text) from public, anon, authenticated, service_role;

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

    if v_client is not null then
      if not kernel.app_session_alive(claims ->> 'session_id') then
        raise exception using errcode = 'KA001', message = 'this app was disconnected';
      end if;
      v_connection := kernel.active_connection(result.actor_id, v_client);
      if v_connection.id is not null then
        -- Connected the new way: the app acts as its own agent, with only what it was granted.
        result.principal_id := result.actor_id;
        result.actor_id := v_connection.agent_id;
        result.kind := 'agent';
      elsif exists (select 1 from kernel.connections c where c.person_id = result.actor_id and c.client_id = v_client) then
        raise exception using errcode = 'KA002', message = 'this app was disconnected';
      else
        -- Connected before SOLVE Connect: may read as the person, may change nothing.
        result.auth_method := 'app_read_only';
      end if;
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

create or replace function kernel.append_event(
  p_caller kernel.caller,
  p_type text,
  p_scope text,
  p_grant uuid,
  p_payload jsonb,
  p_corrects uuid default null,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  if p_caller.auth_method = 'app_read_only' then
    raise exception using errcode = 'KA002',
      message = 'this app can read but not change anything; changes are made in SOLVE, or by an app connected with its own access';
  end if;
  insert into kernel.events (
    type, scope, actor_id, on_behalf_of, grant_id, auth_method,
    payload, corrects, idempotency_key, correlation_id
  ) values (
    p_type, p_scope, p_caller.actor_id, p_caller.principal_id, p_grant, p_caller.auth_method,
    coalesce(p_payload, '{}'::jsonb), p_corrects, p_idempotency_key, p_correlation_id
  )
  returning id into new_id;
  return new_id;
end;
$$;
