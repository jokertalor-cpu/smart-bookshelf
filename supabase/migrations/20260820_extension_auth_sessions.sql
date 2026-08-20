-- SmartBookshelf AI Browser Extension v2 authentication foundation.
-- Stores only hashes of short-lived exchange codes and extension sessions.

create table if not exists public.extension_auth_codes (
  code_hash text primary key,
  state_hash text not null,
  extension_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint extension_auth_codes_code_hash_chk check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint extension_auth_codes_state_hash_chk check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint extension_auth_codes_extension_id_chk check (extension_id ~ '^[a-z0-9_-]{8,64}$')
);

create table if not exists public.extension_sessions (
  session_hash text primary key,
  extension_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint extension_sessions_session_hash_chk check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint extension_sessions_extension_id_chk check (extension_id ~ '^[a-z0-9_-]{8,64}$')
);

create index if not exists extension_auth_codes_expiry_idx
  on public.extension_auth_codes (expires_at);
create index if not exists extension_sessions_user_idx
  on public.extension_sessions (user_id, extension_id);
create index if not exists extension_sessions_expiry_idx
  on public.extension_sessions (expires_at);

alter table public.extension_auth_codes enable row level security;
alter table public.extension_sessions enable row level security;

revoke all on table public.extension_auth_codes from anon, authenticated;
revoke all on table public.extension_sessions from anon, authenticated;

create or replace function public.issue_extension_code(
  p_code_hash text,
  p_state_hash text,
  p_extension_id text,
  p_ttl_seconds integer default 300
)
returns table(expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid code hash';
  end if;
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid state hash';
  end if;
  if p_extension_id is null or p_extension_id !~ '^[a-z0-9_-]{8,64}$' then
    raise exception 'Invalid extension id';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 600 then
    raise exception 'Invalid code TTL';
  end if;

  delete from public.extension_auth_codes
   where expires_at < now() or used_at is not null;

  v_expires := now() + make_interval(secs => p_ttl_seconds);
  insert into public.extension_auth_codes(code_hash, state_hash, extension_id, user_id, expires_at)
  values (p_code_hash, p_state_hash, p_extension_id, auth.uid(), v_expires);

  return query select v_expires;
end;
$$;

create or replace function public.exchange_extension_code(
  p_code_hash text,
  p_extension_id text,
  p_session_hash text,
  p_session_ttl_seconds integer default 43200
)
returns table(user_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.extension_auth_codes%rowtype;
  v_expires timestamptz;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$'
     or p_extension_id is null or p_extension_id !~ '^[a-z0-9_-]{8,64}$' then
    raise exception 'Invalid extension exchange data';
  end if;
  if p_session_ttl_seconds is null or p_session_ttl_seconds < 900 or p_session_ttl_seconds > 86400 then
    raise exception 'Invalid session TTL';
  end if;

  delete from public.extension_auth_codes
   where expires_at < now() or used_at is not null;
  delete from public.extension_sessions
   where expires_at < now() or revoked_at is not null;

  select * into v_code
    from public.extension_auth_codes
   where code_hash = p_code_hash
     and extension_id = p_extension_id
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Extension code expired or already used';
  end if;

  update public.extension_auth_codes
     set used_at = now()
   where code_hash = p_code_hash;

  v_expires := now() + make_interval(secs => p_session_ttl_seconds);
  insert into public.extension_sessions(session_hash, extension_id, user_id, expires_at)
  values (p_session_hash, p_extension_id, v_code.user_id, v_expires);

  return query select v_code.user_id, v_expires;
end;
$$;

create or replace function public.get_extension_session(
  p_session_hash text,
  p_extension_id text
)
returns table(user_id uuid, gemini_api_key text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$'
     or p_extension_id is null or p_extension_id !~ '^[a-z0-9_-]{8,64}$' then
    raise exception 'Invalid extension session';
  end if;

  return query
  update public.extension_sessions s
     set last_used_at = now()
   where s.session_hash = p_session_hash
     and s.extension_id = p_extension_id
     and s.revoked_at is null
     and s.expires_at > now()
  returning s.user_id,
    (select us.gemini_api_key from public.user_settings us where us.user_id = s.user_id),
    s.expires_at;
end;
$$;

create or replace function public.revoke_extension_session(
  p_session_hash text,
  p_extension_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$'
     or p_extension_id is null or p_extension_id !~ '^[a-z0-9_-]{8,64}$' then
    return false;
  end if;
  update public.extension_sessions
     set revoked_at = now()
   where session_hash = p_session_hash
     and extension_id = p_extension_id
     and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.issue_extension_code(text, text, text, integer) from public;
revoke all on function public.exchange_extension_code(text, text, text, integer) from public;
revoke all on function public.get_extension_session(text, text) from public;
revoke all on function public.revoke_extension_session(text, text) from public;

grant execute on function public.issue_extension_code(text, text, text, integer) to authenticated;
grant execute on function public.exchange_extension_code(text, text, text, integer) to anon;
grant execute on function public.get_extension_session(text, text) to anon;
grant execute on function public.revoke_extension_session(text, text) to anon;
