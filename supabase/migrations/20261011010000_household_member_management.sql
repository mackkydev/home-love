-- Members may see the people in their home. Only its owner may change roles or remove members.
create or replace function public.list_household_people(target_household uuid)
returns table(user_id uuid, email text, display_name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_household_member(target_household) then
    raise exception 'Not a member of this household';
  end if;
  return query
    select m.user_id, coalesce(u.email, ''),
      coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), 'Member'),
      m.role, m.joined_at
    from public.household_members m
    join auth.users u on u.id = m.user_id
    where m.household_id = target_household
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at;
end;
$$;

create or replace function public.manage_household_person(target_household uuid, target_user uuid, next_role text, remove_person boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
  current_role text;
begin
  select role into actor_role from public.household_members where household_id = target_household and user_id = auth.uid();
  if actor_role is distinct from 'owner' then raise exception 'Only the household owner can manage members'; end if;
  if target_user = auth.uid() then raise exception 'The owner cannot change their own membership'; end if;
  select role into current_role from public.household_members where household_id = target_household and user_id = target_user for update;
  if current_role is null then raise exception 'Member not found'; end if;
  if current_role = 'owner' then raise exception 'Cannot change another owner'; end if;
  if remove_person then
    delete from public.household_members where household_id = target_household and user_id = target_user;
  else
    if next_role not in ('admin', 'member') or next_role is null then raise exception 'Role must be admin or member'; end if;
    update public.household_members set role = next_role where household_id = target_household and user_id = target_user;
  end if;
end;
$$;

revoke all on function public.list_household_people(uuid) from public;
revoke all on function public.manage_household_person(uuid, uuid, text, boolean) from public;
grant execute on function public.list_household_people(uuid) to authenticated;
grant execute on function public.manage_household_person(uuid, uuid, text, boolean) to authenticated;
