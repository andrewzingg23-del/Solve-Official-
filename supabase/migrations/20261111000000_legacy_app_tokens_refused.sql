-- Close the legacy app-token read (verified on staging 2026-11-10, docs/architecture/2026-11-10-reusable-foundation.md §6).
--
-- 20261110080000 contained apps connected before per-app agents to READ-ONLY, but they still read as
-- the person — so an app could read a Space where the person had set its access to Off, by calling the
-- kernel directly with its own token. Now such a token is refused outright. The person reconnects the
-- app (Apps → connect again); connect_app makes it its own agent, which starts with nothing and reaches
-- only the Spaces the person lets it into. The person's own sessions (no client_id) are untouched.

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
        -- Connected before SOLVE Connect. It used to read as the person, which let it read every
        -- Space whatever the person chose for it. Refused now: the person reconnects it, and it
        -- becomes its own agent with only what they grant (20261110070000).
        raise exception using errcode = 'KA002', message = 'reconnect this app in Solve: apps now connect as themselves, with only what you allow';
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
