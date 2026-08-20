-- Bind extension code exchange to the original callback state hash.
-- The previous overload is removed to avoid an unsigned state-free exchange path.

drop function if exists public.exchange_extension_code(text, text, text, integer);

create or replace function public.exchange_extension_code(
  p_code_hash text,
  p_state_hash text,
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
     or p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$'
     or p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$'
     or p_extension_id is null or p_extension_id !~ '^[a-z0-9_-]{8,64}$' then
    raise exception 'Invalid extension exchange data';
  end if;
  if p_session_ttl_seconds is null or p_session_ttl_seconds < 900 or p_session_ttl_seconds > 86400 then
    raise exception 'Invalid session TTL';
  end if;

  delete from public.extension_auth_codes where expires_at < now() or used_at is not null;
  delete from public.extension_sessions where expires_at < now() or revoked_at is not null;

  select * into v_code
    from public.extension_auth_codes
   where code_hash = p_code_hash
     and state_hash = p_state_hash
     and extension_id = p_extension_id
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Extension code expired, state mismatch, or already used';
  end if;

  update public.extension_auth_codes set used_at = now() where code_hash = p_code_hash;
  v_expires := now() + make_interval(secs => p_session_ttl_seconds);
  insert into public.extension_sessions(session_hash, extension_id, user_id, expires_at)
  values (p_session_hash, p_extension_id, v_code.user_id, v_expires);

  return query select v_code.user_id, v_expires;
end;
$$;

revoke all on function public.exchange_extension_code(text, text, text, text, integer) from public;
grant execute on function public.exchange_extension_code(text, text, text, text, integer) to anon;
