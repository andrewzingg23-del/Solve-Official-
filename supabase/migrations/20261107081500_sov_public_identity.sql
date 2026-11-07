-- SOV public identity, distinct from private Home, chat, AI memory, and kernel events.
-- Public shares require an affirmative authenticated publication action.
-- Stable public_id supports physical NFC/QR cards even if the person changes handle.
create table if not exists public.sov_public_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  handle text unique,
  display_name text not null,
  tagline text not null default '',
  about text not null default '',
  public_email text,
  website text,
  featured_url text,
  appearance text not null default 'default',
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint sov_name_valid check (length(btrim(display_name)) between 1 and 90),
  constraint sov_handle_valid check (handle is null or handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  constraint sov_tagline_length check (length(tagline) <= 100),
  constraint sov_about_length check (length(about) <= 500),
  constraint sov_email_length check (public_email is null or length(public_email) <= 254),
  constraint sov_website_length check (website is null or (length(website) <= 2048 and website like 'https://%')),
  constraint sov_featured_length check (featured_url is null or (length(featured_url) <= 2048 and featured_url like 'https://%')),
  constraint sov_appearance_valid check (appearance in ('default','secondary'))
);

alter table public.sov_public_profiles enable row level security;
revoke all on public.sov_public_profiles from anon, authenticated;
grant select, insert, update, delete on public.sov_public_profiles to authenticated;
grant select on public.sov_public_profiles to anon;

create policy "sov_profile_guest_reads_published"
on public.sov_public_profiles for select to anon
using (published = true);

create policy "sov_profile_authenticated_reads_own_or_published"
on public.sov_public_profiles for select to authenticated
using (published = true or owner_id = (select auth.uid()));

create policy "sov_profile_owner_insert"
on public.sov_public_profiles for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "sov_profile_owner_update"
on public.sov_public_profiles for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "sov_profile_owner_delete"
on public.sov_public_profiles for delete to authenticated
using (owner_id = (select auth.uid()));

create index if not exists sov_public_profiles_published_lookup
  on public.sov_public_profiles(public_id) where published = true;

comment on table public.sov_public_profiles is
  'Owner-approved public SOV ID projection. Not a source of private memory, wallet keys, grants, or account verification.';
