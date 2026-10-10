-- Controls which registration choices are shown on the app's sign-in screen.
-- Existing members can continue to use either sign-in method.
alter table public.app_signup_settings
  add column signup_methods text not null default 'both'
  check (signup_methods in ('both', 'password', 'email_link'));

create function public.get_signup_methods()
returns text language sql stable security definer
set search_path = '' as $$
  select coalesce(
    (select signup_methods from public.app_signup_settings where singleton = true),
    'both'
  );
$$;

create function public.set_signup_methods(new_value text)
returns text language plpgsql security definer
set search_path = '' as $$
begin
  if new_value not in ('both', 'password', 'email_link') or new_value is null or not public.is_app_admin() then
    raise exception 'Only an application admin can change signup methods';
  end if;

  update public.app_signup_settings
  set signup_methods = new_value, updated_at = now(), updated_by = auth.uid()
  where singleton = true;
  return new_value;
end;
$$;

revoke all on function public.get_signup_methods() from public;
revoke all on function public.set_signup_methods(text) from public;
grant execute on function public.get_signup_methods() to anon, authenticated;
grant execute on function public.set_signup_methods(text) to authenticated;
