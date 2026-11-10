-- A public page shows only what its owner deliberately selected.
--
-- 20261110050000 published every piece the owner made. Review of that slice (2026-11-10): the owner
-- must choose, piece by piece, and see exactly what will be public before it is. The publication
-- record in the owner's own scope now carries `pieces`: the ids the owner ticked. A piece appears
-- only if it is in that list AND is still purely the owner's own (created and last edited by them,
-- not private) — so a selection can never publish a friend's contribution, and a piece a friend
-- later edits drops off the page. A record without a list publishes no pieces at all.

create or replace function kernel.page_selection(p_world_id uuid, p_owner uuid)
returns uuid[]
language sql stable set search_path = '' as $$
  select coalesce(array(
    select s.value::uuid
    from kernel.entities en
    join lateral (select ev.attributes from kernel.entity_versions ev where ev.entity_id = en.id order by ev.version desc limit 1) v on true
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(v.attributes -> 'pieces') = 'array' then v.attributes -> 'pieces' else '[]'::jsonb end) s(value)
    where en.scope = 'actor:' || p_owner::text
      and v.attributes ->> 'sov' = 'solve.page' and v.attributes ->> 'worldId' = p_world_id::text
      and s.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), '{}'::uuid[]);
$$;

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
      and p.entity_id = any(kernel.page_selection(v_world, v_owner))
  );
exception when others then
  return false;
end;
$$;

revoke all on function kernel.page_selection(uuid, uuid) from public;
