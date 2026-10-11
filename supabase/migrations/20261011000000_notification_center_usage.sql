-- Read state is private to each member while notifications are derived from household records.
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  occurrence_key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, household_id, occurrence_key)
);
create index if not exists notification_reads_household_idx on public.notification_reads(household_id, user_id);
alter table public.notification_reads enable row level security;
create policy notification_reads_select on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()) and public.is_household_member(household_id));
create policy notification_reads_insert on public.notification_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_household_member(household_id));
create policy notification_reads_update on public.notification_reads for update to authenticated
  using (user_id = (select auth.uid()) and public.is_household_member(household_id))
  with check (user_id = (select auth.uid()) and public.is_household_member(household_id));
grant select, insert, update on public.notification_reads to authenticated;

-- Project-level measurements. Billing-cycle quotas remain in the provider dashboards.
create or replace function public.get_app_resource_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  database_bytes bigint;
  storage_bytes bigint;
  storage_objects bigint;
  entry_count bigint;
  member_count bigint;
begin
  if not public.is_app_admin() then
    raise exception 'Only an application admin can view resource usage';
  end if;
  select pg_database_size(current_database()) into database_bytes;
  select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end), 0), count(*)
    into storage_bytes, storage_objects from storage.objects;
  select count(*) into entry_count from public.entries;
  select count(*) into member_count from auth.users;
  return jsonb_build_object(
    'databaseBytes', database_bytes,
    'storageBytes', storage_bytes,
    'storageObjects', storage_objects,
    'entries', entry_count,
    'users', member_count,
    'measuredAt', now()
  );
end;
$$;
revoke all on function public.get_app_resource_usage() from public;
grant execute on function public.get_app_resource_usage() to authenticated;
