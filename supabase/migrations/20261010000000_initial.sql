-- Home Love: one household can contain several members and records.
create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'บ้านของเรา',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.entries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create index entries_household_updated_idx on public.entries(household_id, updated_at desc);

create table public.household_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  color text not null default 'blue',
  unique (household_id, name)
);

-- SECURITY DEFINER avoids recursive RLS checks on household_members.
create function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = (select auth.uid())
  );
$$;

create function public.can_edit_household(target_household uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create function public.ensure_personal_household()
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  result uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  select household_id into result
  from public.household_members
  where user_id = current_user_id
  order by joined_at limit 1;
  if result is not null then return result; end if;

  insert into public.households(created_by) values (current_user_id)
  returning id into result;
  insert into public.household_members(household_id, user_id, role)
  values (result, current_user_id, 'owner');
  return result;
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.can_edit_household(uuid) from public;
revoke all on function public.ensure_personal_household() from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_edit_household(uuid) to authenticated;
grant execute on function public.ensure_personal_household() to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.entries enable row level security;
alter table public.household_categories enable row level security;

create policy households_read on public.households for select to authenticated
using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
using (public.can_edit_household(id)) with check (public.can_edit_household(id));

create policy members_read on public.household_members for select to authenticated
using (public.is_household_member(household_id));

create policy entries_read on public.entries for select to authenticated
using (public.is_household_member(household_id));
create policy entries_insert on public.entries for insert to authenticated
with check (public.is_household_member(household_id));
create policy entries_update on public.entries for update to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy entries_delete on public.entries for delete to authenticated
using (public.is_household_member(household_id));

create policy categories_read on public.household_categories for select to authenticated
using (public.is_household_member(household_id));
create policy categories_insert on public.household_categories for insert to authenticated
with check (public.is_household_member(household_id));
create policy categories_update on public.household_categories for update to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy categories_delete on public.household_categories for delete to authenticated
using (public.is_household_member(household_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-files', 'household-files', false, 1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Files are stored under household_id/entry_id/file_name.
create policy household_files_read on storage.objects for select to authenticated
using (bucket_id = 'household-files' and public.is_household_member((storage.foldername(name))[1]::uuid));
create policy household_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'household-files' and public.is_household_member((storage.foldername(name))[1]::uuid));
create policy household_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'household-files' and public.is_household_member((storage.foldername(name))[1]::uuid));
