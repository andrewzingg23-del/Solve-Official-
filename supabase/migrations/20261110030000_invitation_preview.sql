-- What a person holding an invitation link may see before they join: who invited them, and to what.
--
-- The invite page used to say only "you've been invited to a World; details appear after you
-- join", so the moment that matters most — a friend asking you to build something with them —
-- arrived as a generic message. This returns the thing's title and the inviter's chosen name,
-- without accepting the invitation, without granting anything, and without revealing anything else
-- about the thing or anyone in it.
--
-- Same rules as accept_world_invitation (20261009050000): the raw token is hashed here and never
-- stored or logged; an unknown, malformed or cancelled link is indistinguishable from any other
-- unavailable one, so the existence of anything cannot be learned by guessing.

create or replace function kernel_api.read_world_invitation(p_token text, p_as_actor uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  i kernel.world_invitations;
  v_title text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'KA007', message = 'Invitation is unavailable';
  end if;
  select * into i from kernel.world_invitations inv
    where inv.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex');
  if not found or i.cancelled_at is not null then
    raise exception using errcode = 'KA007', message = 'Invitation is unavailable';
  end if;

  -- The thing's own title, from its latest version — and nothing else about it.
  select ev.title into v_title
  from kernel.entities en
  join lateral (
    select ev2.title from kernel.entity_versions ev2 where ev2.entity_id = en.id order by ev2.version desc limit 1
  ) ev on true
  where en.scope = 'world:' || i.world_id::text and en.kind = 'world'
  limit 1;

  return jsonb_build_object(
    'title', coalesce(v_title, ''),
    'invited_by', coalesce(kernel.actor_label(i.owner_id), ''),
    'role', i.role,
    'expires_at', i.expires_at,
    'expired', i.expires_at <= now(),
    'used', i.accepted_by is not null,
    'used_by_you', i.accepted_by is not null and i.accepted_by = c.actor_id,
    'is_yours', i.owner_id = c.actor_id
  );
end;
$$;

revoke all on function kernel_api.read_world_invitation(text, uuid) from public, anon;
grant execute on function kernel_api.read_world_invitation(text, uuid) to authenticated, service_role;
