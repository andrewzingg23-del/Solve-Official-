-- Two additions to the core. Nothing existing is altered: no applied migration is edited, no
-- function is replaced, no table is changed.
--
-- 1. Object types. The kernel could store entities but not say what one *is*: `attributes` was an
--    unchecked blob, so two people could both write kind='project' with nothing in common. A type
--    is itself an entity, so it inherits scope, authority, versioning and history for free.
--    entities.kind is a closed ontology, so types and their objects are `resource` entities
--    marked `sov`, exactly as community projects already are. The constraint is not widened. This is what lets one system serve a recruiting pipeline and a neighbourhood
--    kitchen without a new engine for each.
--
-- 2. Export. Sovereignty means a person can leave and take their work. Until now nothing could
--    leave. export_mine() returns everything the caller holds authority over, as one document.

------------------------------------------------------------------------------------------------
-- Field validation. Deliberately small: presence and primitive shape, nothing more. A type system
-- that tries to express everything becomes a second source of truth about what is allowed.

create or replace function kernel.validate_fields(p_fields jsonb, p_data jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  k text; spec jsonb; want text; got text;
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception using errcode = 'KA003', message = 'A type needs an object of fields';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = 'KA003', message = 'An object needs its data as an object';
  end if;

  for k, spec in select key, value from jsonb_each(p_fields) loop
    want := coalesce(spec ->> 'type', 'text');
    if not (p_data ? k) or jsonb_typeof(p_data -> k) = 'null' then
      if coalesce((spec ->> 'required')::boolean, false) then
        raise exception using errcode = 'KA003', message = format('%s is required', k);
      end if;
      continue;
    end if;
    got := jsonb_typeof(p_data -> k);
    if want in ('text', 'date') and got <> 'string' then
      raise exception using errcode = 'KA003', message = format('%s must be text', k);
    elsif want = 'number' and got <> 'number' then
      raise exception using errcode = 'KA003', message = format('%s must be a number', k);
    elsif want = 'boolean' and got <> 'boolean' then
      raise exception using errcode = 'KA003', message = format('%s must be true or false', k);
    elsif want = 'list' and got <> 'array' then
      raise exception using errcode = 'KA003', message = format('%s must be a list', k);
    end if;
  end loop;
end;
$$;

-- The fields of a type, found in the given scope or any scope above it, so a type defined once for
-- a community is usable in every World beneath it.
create or replace function kernel.type_fields(p_actor uuid, p_type text, p_scope text)
returns jsonb language sql stable set search_path = '' as $$
  select e.attributes -> 'fields'
  from kernel.entities en
  join lateral (
    select ev.title, ev.attributes, ev.version
    from kernel.entity_versions ev
    where ev.entity_id = en.id
    order by ev.version desc
    limit 1
  ) e on true
  where en.kind = 'resource'
    and e.attributes ->> 'sov' = 'solve.type'
    and kernel.scope_covers(en.scope, p_scope)
    and e.title = p_type
    and kernel.find_grant(p_actor, 'world.entity.read', en.scope) is not null
  order by length(en.scope) desc
  limit 1;
$$;

------------------------------------------------------------------------------------------------
-- Declare what a kind of thing is. Writing a type is an ordinary entity write, so it needs the
-- same authority as any other write in that scope.

create or replace function kernel_api.define_type(
  p_type text, p_scope text, p_fields jsonb, p_label text default null,
  p_idempotency_key text default null, p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  if p_type is null or p_type !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception using errcode = 'KA003', message = 'A type name is lowercase letters, digits and underscores';
  end if;
  if p_type = 'type' then
    raise exception using errcode = 'KA003', message = 'A type cannot be called type';
  end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' or p_fields = '{}'::jsonb then
    raise exception using errcode = 'KA003', message = 'A type needs at least one field';
  end if;
  perform kernel.require_scope(p_scope);
  perform kernel.lock_chain();
  return kernel.do_upsert_entity(
    c, kernel.require_allowed(c.actor_id, 'world.entity.write', p_scope), null,
    'resource', p_scope, p_type, p_label,
    jsonb_build_object('sov', 'solve.type', 'fields', p_fields),
    null, null, null, null, 'members', null, p_idempotency_key);
end;
$$;

-- Create or revise one thing of a declared type. The data is checked against the type before the
-- kernel records anything, so a malformed object never enters history.
create or replace function kernel_api.put_object(
  p_type text, p_scope text, p_title text, p_data jsonb,
  p_object_id uuid default null, p_visibility text default 'private',
  p_idempotency_key text default null, p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_fields jsonb;
begin
  if p_visibility is null or p_visibility not in ('public', 'members', 'private') then
    raise exception using errcode = 'KA003', message = 'Visibility is public, members or private';
  end if;
  perform kernel.require_scope(p_scope);
  v_fields := kernel.type_fields(c.actor_id, p_type, p_scope);
  if v_fields is null then
    raise exception using errcode = 'KA003', message = format('No type called %s here. Declare it first.', p_type);
  end if;
  perform kernel.validate_fields(v_fields, p_data);
  perform kernel.lock_chain();
  return kernel.do_upsert_entity(
    c, kernel.require_allowed(c.actor_id, 'world.entity.write', p_scope), p_object_id,
    'resource', p_scope, p_title, null,
    jsonb_build_object('sov', 'solve.object', 'type', p_type, 'data', p_data),
    null, null, null, null, p_visibility, null, p_idempotency_key);
end;
$$;

------------------------------------------------------------------------------------------------
-- Everything the caller holds authority over, as one document they can take with them. Reads
-- only; it grants nothing and reveals nothing the caller could not already read.

create or replace function kernel_api.export_mine(p_as_actor uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scopes text[];
begin
  select coalesce(array_agg(distinct g.scope), '{}')
    into v_scopes
  from kernel.grants g
  where g.grantee_id = c.actor_id
    and kernel.grant_is_active(g.id);

  return jsonb_build_object(
    'exported_at', now(),
    'actor', (select jsonb_build_object('actor_id', a.id, 'kind', a.kind, 'label', a.label, 'created_at', a.created_at)
              from kernel.actors a where a.id = c.actor_id),
    'scopes', to_jsonb(v_scopes),
    'grants', (select coalesce(jsonb_agg(jsonb_build_object(
                 'capability', g.capability, 'scope', g.scope,
                 'expires_at', g.expires_at, 'created_at', g.created_at) order by g.created_at), '[]'::jsonb)
               from kernel.grants g
               where g.grantee_id = c.actor_id and kernel.grant_is_active(g.id)),
    'things', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', en.id, 'scope', en.scope,
                 'type', coalesce(v.attributes ->> 'type', en.kind),
                 'title', v.title, 'summary', v.summary,
                 'data', coalesce(v.attributes -> 'data', v.attributes),
                 'version', v.version) order by en.created_at), '[]'::jsonb)
               from kernel.entities en
               join lateral (
                 select ev.title, ev.summary, ev.attributes, ev.version
                 from kernel.entity_versions ev where ev.entity_id = en.id
                 order by ev.version desc limit 1
               ) v on true
               where exists (select 1 from unnest(v_scopes) s where kernel.scope_covers(s, en.scope))),
    'history', (select coalesce(jsonb_agg(jsonb_build_object(
                 'seq', e.seq, 'at', e.occurred_at, 'type', e.type, 'scope', e.scope,
                 'payload', e.payload) order by e.seq), '[]'::jsonb)
               from kernel.events e
               where e.actor_id = c.actor_id
                 and not kernel.event_withheld(c.actor_id, e.id, e.type, e.payload))
  );
end;
$$;

------------------------------------------------------------------------------------------------

revoke all on all tables in schema kernel from public, anon, authenticated, service_role;
revoke all on all sequences in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
