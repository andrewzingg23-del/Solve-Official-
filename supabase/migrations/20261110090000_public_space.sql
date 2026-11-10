-- A person's public Space: their card, in their colours, and the things they chose to share as
-- pages — at one link anyone can open with no account (the Card-to-public-Space milestone,
-- docs/direction/2026-11-10-consolidated-direction.md).
--
-- Same rules as a thing's page (20261110050000, 20261110060000):
--   * Publication is a record in the person's own `actor:` scope, `sov = solve.space`,
--     `{ published }`. Only they (or their own agents) can write it; withdrawing is history.
--   * A Space lists only pages that are themselves published, and only for things the person
--     started. Each page's contents remain governed by that page's own selection; the Space adds
--     nothing to what a page shows, and a cover photo is one of the page's own ticked photos.
--   * Nothing about anyone else, no history, no grants. An unknown, unshared or withdrawn Space is
--     indistinguishable from any other unavailable one.
-- read_page now also says where its owner's Space is, but only while that Space is shared.

create or replace function kernel.space_shared(p_actor uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select (v.attributes ->> 'published')::boolean
    from kernel.entities en
    join lateral (select ev.attributes from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
    where en.scope = 'actor:' || p_actor::text and v.attributes ->> 'sov' = 'solve.space'
    limit 1
  ), false);
$$;

create or replace function kernel_api.read_space(p_actor_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_look jsonb;
begin
  if p_actor_id is null or not kernel.space_shared(p_actor_id) then
    raise exception using errcode = 'KA007', message = 'Space is unavailable';
  end if;
  select v.attributes -> 'look' into v_look
  from kernel.entities en
  join lateral (select ev.attributes from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
  where en.scope = 'actor:' || p_actor_id::text and v.attributes ->> 'sov' = 'solve.look'
  limit 1;

  return jsonb_build_object(
    'by', coalesce(kernel.actor_label(p_actor_id), ''),
    'look', coalesce(v_look, '{}'::jsonb),
    'pages', coalesce((
      select jsonb_agg(page order by page ->> 'at' desc)
      from (
        select jsonb_build_object(
          'id', w.world_id,
          'title', coalesce((
            select v.title from kernel.entities en
            join lateral (select ev.title from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
            where en.scope = 'world:' || w.world_id::text and en.kind = 'world' limit 1), ''),
          'cover', (
            select p.attributes -> 'file' ->> 'name'
            from kernel.published_pieces(w.world_id, p_actor_id) p
            where p.attributes ->> 'documentType' = 'photo'
              and p.entity_id = any(kernel.page_selection(w.world_id, p_actor_id))
            order by p.created_at desc limit 1),
          'at', w.at
        ) as page
        from (
          select (v.attributes ->> 'worldId')::uuid as world_id, v.created_at as at
          from kernel.entities en
          join lateral (select ev.attributes, ev.created_at from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
          where en.scope = 'actor:' || p_actor_id::text
            and v.attributes ->> 'sov' = 'solve.page'
            and v.attributes ->> 'worldId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          limit 200
        ) w
        -- Only pages that are published now, of things this person started.
        where kernel.published_page_owner(w.world_id) = p_actor_id
      ) pages
    ), '[]'::jsonb)
  );
end;
$$;

-- A thing's page says where its owner's Space is — only while that Space is shared.
create or replace function kernel_api.read_page(p_world_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner uuid := kernel.published_page_owner(p_world_id);
  v_selected uuid[];
  v_title text; v_summary text; v_look jsonb;
begin
  if v_owner is null then
    raise exception using errcode = 'KA007', message = 'Page is unavailable';
  end if;
  v_selected := kernel.page_selection(p_world_id, v_owner);
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
    'space', case when kernel.space_shared(v_owner) then v_owner end,
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
      where p.entity_id = any(v_selected)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function kernel.space_shared(uuid) from public, anon, authenticated, service_role;
revoke all on function kernel_api.read_space(uuid) from public;
grant execute on function kernel_api.read_space(uuid) to anon, authenticated, service_role;
