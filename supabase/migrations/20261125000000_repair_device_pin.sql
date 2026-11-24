-- Repairs PIN functions without removing existing PINs, users or household data.
-- Also installs the PIN service on databases that missed its original migration.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- A PIN unlocks an already authenticated device session. It never issues an Auth token.
-- The private HMAC key lets us enforce uniqueness without storing a searchable PIN hash.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.pin_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null
);
-- Keep the existing secret: changing it would invalidate PIN uniqueness checks.
do $key$
declare crypto_schema name;
begin
  select n.nspname into strict crypto_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  execute format('insert into private.pin_key(singleton, secret) values (true, %I.gen_random_bytes(32)) on conflict (singleton) do nothing', crypto_schema);
end;
$key$;
revoke all on private.pin_key from public, anon, authenticated;

create table if not exists private.device_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  fingerprint bytea not null unique,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on private.device_pins from public, anon, authenticated;

create table if not exists private.pin_set_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started timestamptz not null default now()
);
revoke all on private.pin_set_limits from public, anon, authenticated;

create or replace function public.has_device_pin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from private.device_pins where user_id = (select auth.uid()));
$$;

create or replace function public.verify_device_pin(candidate text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, extensions as $$
declare record_pin private.device_pins%rowtype;
begin
  if auth.uid() is null or candidate is null or candidate !~ '^[0-9]{6}$' then return false; end if;
  select * into record_pin from private.device_pins where user_id = auth.uid() for update;
  if not found or record_pin.locked_until > now() then return false; end if;
  if crypt(candidate, record_pin.pin_hash) = record_pin.pin_hash then
    update private.device_pins set failed_attempts = 0, locked_until = null where user_id = auth.uid();
    return true;
  end if;
  update private.device_pins
  set failed_attempts = case when record_pin.failed_attempts >= 4 then 0 else record_pin.failed_attempts + 1 end,
      locked_until = case when record_pin.failed_attempts >= 4 then now() + interval '15 minutes' else null end
  where user_id = auth.uid();
  return false;
end;
$$;

create or replace function public.set_device_pin(new_pin text, current_pin text default null)
returns boolean language plpgsql security definer
set search_path = pg_catalog, extensions as $$
declare record_pin private.device_pins%rowtype;
declare secret_value bytea;
declare pin_fingerprint bytea;
declare set_attempts integer;
begin
  if auth.uid() is null then raise exception 'Sign in before setting a PIN'; end if;
  if new_pin !~ '^[0-9]{6}$' or new_pin is null then raise exception 'PIN must contain exactly six digits'; end if;
  insert into private.pin_set_limits as limits(user_id, attempts)
  values (auth.uid(), 1)
  on conflict (user_id) do update set
    attempts = case when limits.window_started < now() - interval '1 hour' then 1 else limits.attempts + 1 end,
    window_started = case when limits.window_started < now() - interval '1 hour' then now() else limits.window_started end
  returning attempts into set_attempts;
  if set_attempts > 10 then return false; end if;
  select * into record_pin from private.device_pins where user_id = auth.uid() for update;
  if found then
    if record_pin.locked_until > now() then raise exception 'PIN temporarily locked. Try again in 15 minutes'; end if;
    if current_pin is null or not public.verify_device_pin(current_pin) then return false; end if;
  end if;
  select secret into secret_value from private.pin_key where singleton = true;
  pin_fingerprint := hmac(convert_to(new_pin, 'UTF8'), secret_value, 'sha256');
  if exists (select 1 from private.device_pins where fingerprint = pin_fingerprint) then return false; end if;
  insert into private.device_pins(user_id, pin_hash, fingerprint)
  values (auth.uid(), crypt(new_pin, gen_salt('bf', 12)), pin_fingerprint)
  on conflict (user_id) do update set pin_hash = excluded.pin_hash,
    fingerprint = excluded.fingerprint, failed_attempts = 0,
    locked_until = null, updated_at = now();
  return true;
end;
$$;

revoke all on function public.has_device_pin() from public;
revoke all on function public.verify_device_pin(text) from public;
revoke all on function public.set_device_pin(text, text) from public;
grant execute on function public.has_device_pin() to authenticated;
grant execute on function public.verify_device_pin(text) to authenticated;
grant execute on function public.set_device_pin(text, text) to authenticated;

-- pgcrypto can already be installed in public or extensions. Use its actual schema.
-- A quoted comma-separated string is ONE schema name, not a search path list.
do $path$
declare crypto_schema name;
begin
  select n.nspname into strict crypto_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  execute format('alter function public.verify_device_pin(text) set search_path = pg_catalog, %I', crypto_schema);
  execute format('alter function public.set_device_pin(text, text) set search_path = pg_catalog, %I', crypto_schema);
end;
$path$;

alter table private.pin_key enable row level security;
alter table private.device_pins enable row level security;
alter table private.pin_set_limits enable row level security;
notify pgrst, 'reload schema';
commit;
