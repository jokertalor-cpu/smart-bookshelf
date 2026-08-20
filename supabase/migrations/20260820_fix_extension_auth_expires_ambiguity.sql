-- Fix PL/pgSQL ambiguity between RETURNS TABLE(expires_at) and table columns.
-- Every expires_at/used_at/code_hash reference is explicitly qualified.

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

  delete from public.extension_auth_codes as eac
   where eac.expires_at < now() or eac.used_at is not null;

  v_expires := now() + make_interval(secs => p_ttl_seconds);
  insert into public.extension_auth_codes(code_hash, state_hash, extension_id, user_id, expires_at)
  values (p_code_hash, p_state_hash, p_extension_id, auth.uid(), v_expires);

  return query select v_expires;
end;
$$;

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

  delete from public.extension_auth_codes as eac
   where eac.expires_at < now() or eac.used_at is not null;
  delete from public.extension_sessions as es
   where es.expires_at < now() or es.revoked_at is not null;

  select eac.* into v_code
    from public.extension_auth_codes as eac
   where eac.code_hash = p_code_hash
     and eac.state_hash = p_state_hash
     and eac.extension_id = p_extension_id
     and eac.used_at is null
     and eac.expires_at > now()
   for update;

  if not found then
    raise exception 'Extension code expired, state mismatch, or already used';
  end if;

  update public.extension_auth_codes as eac
     set used_at = now()
   where eac.code_hash = p_code_hash;
  v_expires := now() + make_interval(secs => p_session_ttl_seconds);
  insert into public.extension_sessions(session_hash, extension_id, user_id, expires_at)
  values (p_session_hash, p_extension_id, v_code.user_id, v_expires);

  return query select v_code.user_id, v_expires;
end;
$$;

revoke all on function public.issue_extension_code(text, text, text, integer) from public;
grant execute on function public.issue_extension_code(text, text, text, integer) to authenticated;
revoke all on function public.exchange_extension_code(text, text, text, text, integer) from public;
grant execute on function public.exchange_extension_code(text, text, text, text, integer) to anon;
