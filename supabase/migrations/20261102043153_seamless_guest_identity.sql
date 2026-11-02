-- Verified Supabase anonymous sessions have unique authenticated subjects.
-- Preserve identity links, self-scoped grants, caller checks and all existing ACLs.

create or replace function kernel_api.register(p_label text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  session_role text := nullif(current_setting('role', true), 'none');
  token_subject text := claims ->> 'sub';
  existing uuid;
  new_actor uuid := gen_random_uuid();
  self kernel.caller;
  event_id uuid;
begin
  if claims ->> 'role' is distinct from 'authenticated' or coalesce(session_role, 'authenticated') <> 'authenticated' then
    raise exception using errcode = 'KA001', message = 'register requires a signed-in user';
  end if;
  if token_subject is null or length(token_subject) = 0 then
    raise exception using errcode = 'KA001', message = 'token has no subject';
  end if;

  perform kernel.lock_chain();

  select l.actor_id into existing from kernel.identity_links l
  where l.provider = 'supabase_auth' and l.subject = token_subject;
  if existing is not null then
    return existing;
  end if;

  insert into kernel.actors (id, kind, label) values (new_actor, 'human', coalesce(p_label, ''));
  self := row(new_actor, null::uuid, 'human', 'user_jwt')::kernel.caller;

  event_id := kernel.append_event(
    self, 'kernel.actor.registered', 'actor:' || new_actor, null,
    jsonb_build_object('actor_id', new_actor, 'kind', 'human', 'label', coalesce(p_label, ''),
                       'provider', 'supabase_auth', 'subject', token_subject)
  );
  insert into kernel.identity_links (actor_id, provider, subject, event_id)
  values (new_actor, 'supabase_auth', token_subject, event_id);

  perform kernel.issue_policy_grant(new_actor, '*', 'actor:' || new_actor, 'self');
  return new_actor;
end;
$$;

create or replace function kernel.resolve_caller(p_as_actor uuid) returns kernel.caller
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  jwt_role text := claims ->> 'role';
  session_role text := nullif(current_setting('role', true), 'none');
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
