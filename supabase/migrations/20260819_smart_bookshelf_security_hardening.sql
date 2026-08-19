begin;

-- Keep public browsing working, but remove anonymous write grants.
revoke insert, update, delete on table public.books from anon;
revoke insert, update, delete on table public.banners from anon;
revoke insert, update, delete on table public.seasonal_themes from anon;

-- Books: public reads; only a real admin may manage content.
drop policy if exists "Allow for admin" on public.books;
drop policy if exists "Allow public update count" on public.books;
drop policy if exists "Public read access" on public.books;
create policy "Public can read books"
on public.books for select
to anon, authenticated
using (true);
create policy "Admins can manage books"
on public.books for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- Banners: public reads; only a real admin may manage content.
drop policy if exists "Allow for admin" on public.banners;
drop policy if exists "public_read_access" on public.banners;
create policy "Public can read banners"
on public.banners for select
to anon, authenticated
using (true);
create policy "Admins can manage banners"
on public.banners for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- Seasonal themes: keep public search/read behavior; restrict management to admins.
drop policy if exists "For_all" on public.seasonal_themes;
drop policy if exists "search_themes" on public.seasonal_themes;
create policy "Public can read seasonal themes"
on public.seasonal_themes for select
to anon, authenticated
using (true);
create policy "Admins can manage seasonal themes"
on public.seasonal_themes for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- User-owned data: only the signed-in owner can access it.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
on public.profiles for update
to authenticated
using (
  (select auth.uid()) = id
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  (select auth.uid()) = id
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

drop policy if exists "Users can view their own login history" on public.login_history;
create policy "Users can view their own login history"
on public.login_history for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own provider links" on public.provider_links;
create policy "Users can view their own provider links"
on public.provider_links for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own account" on public.user_accounts;
create policy "Users can view their own account"
on public.user_accounts for select
to authenticated
using ((select auth.uid()) = id);
drop policy if exists "Users can update their own account" on public.user_accounts;
create policy "Users can update their own account"
on public.user_accounts for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Enable delete for other user delete/insert" on public.user_downloads;
drop policy if exists "your cansee their own downloas" on public.user_downloads;
create policy "Users manage their own downloads"
on public.user_downloads for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Enable insert /delete for user" on public.user_likes;
drop policy if exists "Users can see their own likes" on public.user_likes;
create policy "Users manage their own likes"
on public.user_likes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own progress" on public.user_progress;
create policy "Users manage their own progress"
on public.user_progress for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own settings" on public.user_settings;
create policy "Users manage their own settings"
on public.user_settings for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Counter RPCs remain public by design, but can only alter their intended counter.
create or replace function public.increment_likes(row_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if row_id is null or row_id <= 0 then
    raise exception 'invalid book id';
  end if;
  update public.books
  set likes_count = coalesce(likes_count, 0) + 1
  where id = row_id;
end;
$$;

create or replace function public.decrement_likes(row_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if row_id is null or row_id <= 0 then
    raise exception 'invalid book id';
  end if;
  update public.books
  set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
  where id = row_id;
end;
$$;

create or replace function public.increment_download(row_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if row_id is null or row_id <= 0 then
    raise exception 'invalid book id';
  end if;
  update public.books
  set download_count = coalesce(download_count, 0) + 1
  where id = row_id;
end;
$$;
revoke execute on function public.increment_likes(bigint) from public;
revoke execute on function public.decrement_likes(bigint) from public;
revoke execute on function public.increment_download(bigint) from public;
grant execute on function public.increment_likes(bigint) to anon, authenticated;
grant execute on function public.decrement_likes(bigint) to anon, authenticated;
grant execute on function public.increment_download(bigint) to anon, authenticated;

-- Account deletion is authenticated-only and always targets the caller.
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke execute on function public.delete_user() from anon, authenticated, public;
grant execute on function public.delete_user() to authenticated;

-- Signup trigger remains available to the trigger owner, not as a public RPC.
alter function public.handle_new_user() set search_path = pg_catalog, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Login logging is authenticated-only and cannot spoof another user.
create or replace function public.log_user_login(
  p_user_id uuid,
  p_provider varchar,
  p_device_info text default null,
  p_ip_address varchar default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'not allowed';
  end if;
  insert into public.login_history (user_id, provider, device_info, ip_address)
  values (p_user_id, left(coalesce(p_provider, ''), 100), left(p_device_info, 1000), left(p_ip_address, 100));
end;
$$;
revoke execute on function public.log_user_login(uuid, varchar, text, varchar) from anon, authenticated, public;
grant execute on function public.log_user_login(uuid, varchar, text, varchar) to authenticated;

-- Trigger/helper functions use a stable, schema-qualified search path.
alter function public.check_email_uniqueness() set search_path = pg_catalog, public;
alter function public.check_provider_conflict() set search_path = pg_catalog, public;

-- Views retain the same columns and output but obey caller RLS.
create or replace view public.duplicate_email_check
with (security_invoker = true)
as
select email, count(*) as account_count, array_agg(distinct provider) as providers
from public.user_accounts
group by email
having count(*) > 1;

create or replace view public.user_account_details
with (security_invoker = true)
as
select ua.id, ua.email, ua.provider as primary_provider, ua.linked_providers,
       ua.created_at, ua.is_active, count(distinct pl.provider) as total_linked_providers
from public.user_accounts ua
left join public.provider_links pl on ua.id = pl.user_id
group by ua.id, ua.email, ua.provider, ua.linked_providers, ua.created_at, ua.is_active;
revoke select on public.duplicate_email_check, public.user_account_details from anon;

-- Storage remains publicly readable through the public buckets, but only true admins may write.
revoke insert, update, delete on storage.objects from anon;
drop policy if exists "admin upload only 16dfnqf_0 16dfnqf_0" on storage.objects;
drop policy if exists "admin upload only 16dfnqf_0 16dfnqf_1" on storage.objects;
drop policy if exists "admin upload only 16dfnqf_0 16dfnqf_2" on storage.objects;
drop policy if exists "admin upload only 16dfnqf_0 16dfnqf_3" on storage.objects;
drop policy if exists "searchbar 1lcmdwi_0" on storage.objects;
drop policy if exists "searchbar 1lcmdwi_1" on storage.objects;
drop policy if exists "searchbar 1lcmdwi_2" on storage.objects;
drop policy if exists "searchbar 1lcmdwi_3" on storage.objects;
create policy "Admins manage book assets"
on storage.objects for all
to authenticated
using (
  bucket_id = 'book-assets'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (
  bucket_id = 'book-assets'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "Admins manage seasonal assets"
on storage.objects for all
to authenticated
using (
  bucket_id = 'seasonal-assets'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (
  bucket_id = 'seasonal-assets'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

commit;
