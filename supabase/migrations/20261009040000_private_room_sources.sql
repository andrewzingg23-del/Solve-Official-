-- A text revision keeps its existing disclosure level. Reading ordinary World
-- content does not confer permission to revise a private document by known ID.
create or replace function kernel_api.update_document_version(
  p_entity_id uuid, p_scope text, p_expected_version integer, p_title text, p_summary text,
  p_attributes jsonb, p_idempotency_key text, p_as_actor uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); authority uuid; v_version integer; v_visibility text;
begin
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = 'KA003', message = 'A displayed version is required';
  end if;
  perform kernel.require_scope(p_scope);
  perform kernel.lock_chain();
  authority := kernel.require_allowed(c.actor_id, 'world.entity.write', p_scope);
  perform kernel.require_allowed(c.actor_id, 'kernel.read', p_scope);
  if not exists (select 1 from kernel.entities e where e.id = p_entity_id and e.kind = 'document' and e.scope = p_scope) then
    raise exception using errcode = 'KA007', message = 'Document not found in this World';
  end if;
  select v.version, v.visibility into v_version, v_visibility from kernel.entity_versions v
    where v.entity_id = p_entity_id order by v.version desc limit 1;
  if v_visibility = 'private' then perform kernel.require_allowed(c.actor_id, 'world.private.read', p_scope); end if;
  if not exists (select 1 from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = p_idempotency_key) then
    if v_version <> p_expected_version then
      raise exception using errcode = 'KA004', message = 'This document changed. Compare the saved revision before trying again.';
    end if;
  end if;
  return kernel.do_upsert_entity(c, authority, p_entity_id, 'document', p_scope, p_title, p_summary,
    p_attributes, null, null, null, null, v_visibility, 50, p_idempotency_key);
end;
$$;
