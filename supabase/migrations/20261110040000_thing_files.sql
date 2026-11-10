-- Files — first, photos — that belong to a thing, under the thing's own authority.
--
-- The bytes live in one private Supabase Storage bucket, `things`. Storage holds no permissions
-- of its own: every read and every write asks the kernel, through kernel_api.file_allowed, the
-- same question the kernel asks for the thing itself — `kernel.read` to see it, and
-- `world.entity.write` to add to it. Invite someone to build and they can add photos; take their
-- access away and they can no longer read them, because a new signed link is refused. A link
-- already issued lasts only as long as its own expiry (the app issues ten-minute links).
--
-- An object is written once and never changed: there is no update or delete policy, so a file
-- that a piece points at cannot be swapped underneath it. The piece records the file's SHA-256,
-- computed by the server from the stored bytes, so what was added is what is shown.
--
-- Not yet: deletion that destroys the bytes (planned with per-scope keys), files other than
-- images, and public links. Nothing here is public.
--
-- Object names are `<thing uuid>/<file uuid>.<jpg|png|webp>`, so the thing is in the path itself
-- and no lookup table is needed.

create or replace function kernel_api.file_allowed(p_name text, p_capability text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  c kernel.caller;
  d kernel.decision;
begin
  if p_capability not in ('kernel.read', 'world.entity.write') then return false; end if;
  if p_name is null or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  c := kernel.resolve_caller(null);
  d := kernel.decide(c.actor_id, p_capability, 'world:' || split_part(p_name, '/', 1));
  return d.decision = 'ALLOW';
exception when others then
  -- Anyone the kernel can't place — no identity, no grant, a malformed scope — gets no file.
  return false;
end;
$$;

revoke all on function kernel_api.file_allowed(text, text) from public, anon;
grant execute on function kernel_api.file_allowed(text, text) to authenticated, service_role;

-- The bucket and its two rules, only where Supabase Storage exists (the embedded test database
-- has no storage schema; the permission function above is tested there directly).
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('things', 'things', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "things: read with the thing''s read authority" on storage.objects';
  execute 'drop policy if exists "things: add with the thing''s write authority" on storage.objects';
  execute $p$create policy "things: read with the thing's read authority" on storage.objects
    for select to authenticated
    using (bucket_id = 'things' and kernel_api.file_allowed(name, 'kernel.read'))$p$;
  execute $p$create policy "things: add with the thing's write authority" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'things' and kernel_api.file_allowed(name, 'world.entity.write'))$p$;
end;
$$;
