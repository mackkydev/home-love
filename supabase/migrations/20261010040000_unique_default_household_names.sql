-- Give newly created personal homes a recognizable owner label and a short
-- identifier. The UUID remains the real identity; names do not need a global
-- uniqueness constraint because families may choose the same name later.
create or replace function public.ensure_personal_household()
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  result uuid;
  owner_label text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Two devices signing in together must not create two personal homes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));

  select household_id into result
  from public.household_members
  where user_id = current_user_id
  order by joined_at, household_id limit 1;
  if result is not null then return result; end if;

  result := pg_catalog.gen_random_uuid();
  select nullif(pg_catalog.left(pg_catalog.split_part(email, '@', 1), 18), '')
    into owner_label from auth.users where id = current_user_id;

  insert into public.households(id, name, created_by)
  values (result,
    'บ้านของ ' || coalesce(owner_label, 'สมาชิก') || ' #' || pg_catalog.upper(pg_catalog.left(pg_catalog.replace(result::text, '-', ''), 6)),
    current_user_id);
  insert into public.household_members(household_id, user_id, role)
  values (result, current_user_id, 'owner');
  return result;
end;
$$;
