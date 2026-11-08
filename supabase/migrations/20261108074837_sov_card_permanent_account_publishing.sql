-- The public SOV Card is published only by a permanent authenticated account.
-- Supabase anonymous sign-ins use the authenticated DB role: ownership alone is not sufficient.
-- This staging-reviewed migration must follow the first public identity migration.
alter policy "sov_profile_owner_insert" on public.sov_public_profiles
  with check (owner_id = (select auth.uid())
    and ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false));

alter policy "sov_profile_owner_update" on public.sov_public_profiles
  using (owner_id = (select auth.uid())
    and ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false))
  with check (owner_id = (select auth.uid())
    and ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false));

alter policy "sov_profile_owner_delete" on public.sov_public_profiles
  using (owner_id = (select auth.uid())
    and ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false));
