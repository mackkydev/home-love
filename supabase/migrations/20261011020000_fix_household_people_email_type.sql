-- auth.users.email is varchar; the RPC declares its email column as text.
-- Cast explicitly so PL/pgSQL can return the rows without a type mismatch.
create or replace function public.list_household_people(target_household uuid)
returns table(user_id uuid, email text, display_name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_household_member(target_household) then
    raise exception 'Not a member of this household';
  end if;
  return query
    select m.user_id, coalesce(u.email::text, ''),
      coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email::text, ''), '@', 1), 'Member'),
      m.role, m.joined_at
    from public.household_members m
    join auth.users u on u.id = m.user_id
    where m.household_id = target_household
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at;
end;
$$;
