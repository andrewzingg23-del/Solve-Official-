-- A thing's public page: the narrow anonymous public-read path (authorized in principle by the
-- founder; DECISIONS.md 2026-11-09), built for one purpose — a person choosing to show something
-- they made, MySpace-style, to anyone with the link, with no account needed to look.
--
-- What decides publication: a record in the owner's own `actor:` scope, `sov = solve.page`,
-- `{ worldId, published }`. Only the owner (or their own agents) can write that scope, so no new
-- authority rule is needed and someone invited to build cannot publish another person's thing.
-- Publishing and withdrawing are versions of that record: history, and undoable.
--
-- What a page shows, and nothing else:
--   * the thing's title and description;
--   * the owner's chosen name and the named choices of their card look (colours, never anything else);
--   * pieces — text and photos — that the OWNER wrote, where both the piece's first and latest
--     version are the owner's own acts. A friend's contribution to a private thing never becomes
--     public because the owner published the page: that would move someone's data without their
--     consent. Pieces marked private are never shown.
-- No identifiers of people, no history, no members, no grants. An unknown, unpublished or withdrawn
-- page is indistinguishable from any other unavailable one.

create or replace function kernel.published_page_owner(p_world_id uuid)
returns uuid
language sql stable set search_path = '' as $$
  with owner as (
    select e.actor_id from kernel.events e
    where e.scope = 'world:' || p_world_id::text and e.type = 'kernel.scope.claimed'
    order by e.seq limit 1
  ), publication as (
    select v.attributes from kernel.entities en
    join lateral (select ev.attributes from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
    where en.scope = 'actor:' || (select actor_id from owner)::text
      and v.attributes ->> 'sov' = 'solve.page' and v.attributes ->> 'worldId' = p_world_id::text
    limit 1
  )
  select (select actor_id from owner)
  where coalesce((select (attributes ->> 'published')::boolean from publication), false);
$$;

-- The owner's own pieces of a published thing: written by them first and last, and not private.
create or replace function kernel.published_pieces(p_world_id uuid, p_owner uuid)
returns table (entity_id uuid, title text, attributes jsonb, created_at timestamptz)
language sql stable set search_path = '' as $$
  select en.id, v.title, v.attributes, en.created_at
  from kernel.entities en
  join kernel.events first_act on first_act.id = en.event_id
  join lateral (
    select ev.title, ev.attributes, ev.visibility, ev.event_id from kernel.entity_versions ev
    where ev.entity_id = en.id order by ev.version desc limit 1
  ) v on true
  join kernel.events last_act on last_act.id = v.event_id
  where en.scope = 'world:' || p_world_id::text and en.kind = 'document'
    and v.visibility <> 'private'
    and v.attributes ->> 'documentType' in ('text', 'photo')
    and first_act.actor_id = p_owner and last_act.actor_id = p_owner
  order by en.created_at desc
  limit 200;
$$;

create or replace function kernel_api.read_page(p_world_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner uuid := kernel.published_page_owner(p_world_id);
  v_title text; v_summary text; v_look jsonb;
begin
  if v_owner is null then
    raise exception using errcode = 'KA007', message = 'Page is unavailable';
  end if;
  select v.title, v.summary into v_title, v_summary
  from kernel.entities en
  join lateral (select ev.title, ev.summary from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
  where en.scope = 'world:' || p_world_id::text and en.kind = 'world'
  limit 1;
  select v.attributes -> 'look' into v_look
  from kernel.entities en
  join lateral (select ev.attributes from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
  where en.scope = 'actor:' || v_owner::text and v.attributes ->> 'sov' = 'solve.look'
  limit 1;

  return jsonb_build_object(
    'title', coalesce(v_title, ''),
    'summary', coalesce(v_summary, ''),
    'by', coalesce(kernel.actor_label(v_owner), ''),
    'look', coalesce(v_look, '{}'::jsonb),
    'pieces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.entity_id,
        'kind', p.attributes ->> 'documentType',
        'text', case when p.attributes ->> 'documentType' = 'photo'
                     then coalesce(p.attributes ->> 'caption', '')
                     else coalesce(p.attributes ->> 'content', p.title) end,
        'file', case when p.attributes ->> 'documentType' = 'photo' then p.attributes -> 'file' ->> 'name' end,
        'at', p.created_at
      ) order by p.created_at desc)
      from kernel.published_pieces(p_world_id, v_owner) p
    ), '[]'::jsonb)
  );
end;
$$;

-- Whether a stored photo belongs to a published page, so storage can let anyone read it — and only
-- it: the photo must be one of the owner's own published pieces, by its exact name.
create or replace function kernel_api.file_public(p_name text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_world uuid; v_owner uuid;
begin
  if p_name is null or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  v_world := split_part(p_name, '/', 1)::uuid;
  v_owner := kernel.published_page_owner(v_world);
  if v_owner is null then return false; end if;
  return exists (
    select 1 from kernel.published_pieces(v_world, v_owner) p
    where p.attributes ->> 'documentType' = 'photo' and p.attributes -> 'file' ->> 'name' = p_name
  );
exception when others then
  return false;
end;
$$;

revoke all on function kernel.published_page_owner(uuid) from public;
revoke all on function kernel.published_pieces(uuid, uuid) from public;
revoke all on function kernel_api.read_page(uuid) from public;
revoke all on function kernel_api.file_public(text) from public;
-- The one deliberate exception to "anonymous callers get no kernel function": reading a page its
-- owner chose to publish. Anonymous callers may enter the schema; every other function in it still
-- refuses them (each is revoked from public), which tests/kernel/kernel.test.ts checks by listing
-- exactly what anon can execute.
grant usage on schema kernel_api to anon;
grant execute on function kernel_api.read_page(uuid) to anon, authenticated, service_role;
grant execute on function kernel_api.file_public(text) to anon, authenticated, service_role;

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  execute 'drop policy if exists "things: read photos on a published page" on storage.objects';
  execute $p$create policy "things: read photos on a published page" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'things' and kernel_api.file_public(name))$p$;
end;
$$;
