-- Run after 20261010000000_initial.sql. Invite codes are single-use and expire after 7 days.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id),
  used_at timestamptz
);

alter table public.household_invites enable row level security;
-- No direct client access to invitation codes. Only the functions below can use this table.

create function public.create_household_invite(target_household uuid)
returns text language plpgsql security definer
set search_path = '' as $$
declare
  invite_code text;
begin
  if auth.uid() is null or not public.can_edit_household(target_household) then
    raise exception 'Only a household owner or admin can invite members';
  end if;

  invite_code := replace(gen_random_uuid()::text, '-', '');
  insert into public.household_invites(household_id, code, created_by)
  values (target_household, invite_code, auth.uid());
  return invite_code;
end;
$$;

create function public.join_household_by_code(invite_code text)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  invitation public.household_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into invitation
  from public.household_invites
  where code = lower(trim(invite_code))
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation code is invalid, expired, or already used';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = invitation.household_id and user_id = auth.uid()
  ) then
    return invitation.household_id;
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (invitation.household_id, auth.uid(), 'member');
  update public.household_invites
  set used_by = auth.uid(), used_at = now()
  where id = invitation.id;
  return invitation.household_id;
end;
$$;

revoke all on function public.create_household_invite(uuid) from public;
revoke all on function public.join_household_by_code(text) from public;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;
