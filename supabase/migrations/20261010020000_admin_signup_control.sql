-- Run after the initial migration. The Before User Created Auth Hook must also be
-- enabled in the Supabase Dashboard for this setting to block direct API signups.

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create table public.app_signup_settings (
  singleton boolean primary key default true check (singleton),
  signup_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.app_signup_settings(singleton, signup_open) values (true, true);
alter table public.app_signup_settings enable row level security;

-- Bootstrap only when there is exactly one existing account. For projects with
-- multiple accounts, assign the intended admin explicitly in the SQL Editor.
insert into public.app_admins(user_id)
select id from auth.users
where (select count(*) from auth.users) = 1
on conflict do nothing;

create function public.is_app_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

create function public.get_signup_open()
returns boolean language sql stable security definer
set search_path = '' as $$
  select coalesce(
    (select signup_open from public.app_signup_settings where singleton = true),
    true
  );
$$;

create function public.set_signup_open(new_value boolean)
returns boolean language plpgsql security definer
set search_path = '' as $$
begin
  if new_value is null or not public.is_app_admin() then
    raise exception 'Only an application admin can change signup settings';
  end if;

  update public.app_signup_settings
  set signup_open = new_value, updated_at = now(), updated_by = auth.uid()
  where singleton = true;
  return new_value;
end;
$$;

revoke all on function public.is_app_admin() from public;
revoke all on function public.get_signup_open() from public;
revoke all on function public.set_signup_open(boolean) from public;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.get_signup_open() to anon, authenticated;
grant execute on function public.set_signup_open(boolean) to authenticated;

-- Supabase Auth calls this function before inserting a new auth.users row.
-- It runs as supabase_auth_admin and reads only the signup setting.
create function public.before_user_created_signup_gate(event jsonb)
returns jsonb language plpgsql
set search_path = '' as $$
begin
  if exists (
    select 1 from public.app_signup_settings
    where singleton = true and signup_open = false
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Registration is currently closed.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.before_user_created_signup_gate(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant select on public.app_signup_settings to supabase_auth_admin;
create policy signup_setting_auth_hook on public.app_signup_settings
for select to supabase_auth_admin using (true);
grant execute on function public.before_user_created_signup_gate(jsonb) to supabase_auth_admin;
