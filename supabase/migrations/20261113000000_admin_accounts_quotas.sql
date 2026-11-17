-- Admin accounts, household entitlements and server-enforced quotas.
-- Apply before deploying this app version. Existing files/records are never deleted.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.user_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 max_households integer not null default 1 check(max_households between 0 and 1000),
 owned_households integer not null default 0 check(owned_households >= 0),
 reason text not null default '' check(length(reason) <= 500),
 updated_at timestamptz not null default now()
);
create table public.household_limits (
 household_id uuid primary key references public.households(id) on delete cascade,
 enabled boolean not null default true,
 plan_key text not null default 'free' check(length(plan_key) between 1 and 80),
 subscription_status text not null default 'free' check(subscription_status in ('free','trial','active','past_due','canceled')),
 expires_at timestamptz,
 uploads_enabled boolean not null default true,
 max_storage_bytes bigint not null default 20971520 check(max_storage_bytes between 0 and 1099511627776),
 max_file_bytes bigint not null default 1048576 check(max_file_bytes between 0 and 3145728),
 max_entries integer not null default 1000 check(max_entries between 0 and 1000000),
 max_members integer not null default 5 check(max_members between 1 and 10000),
 entry_count integer not null default 0 check(entry_count >= 0),
 member_count integer not null default 0 check(member_count >= 0),
 updated_at timestamptz not null default now()
);
create table private.upload_reservations (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 path text not null unique,
 bytes bigint not null check(bytes > 0),
 created_at timestamptz not null default now()
);
create index on private.upload_reservations(household_id);
-- Only the guarded SECURITY DEFINER functions manage reservations.
alter table private.upload_reservations enable row level security;
revoke all on private.upload_reservations from public, anon, authenticated;
create table public.admin_audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 target_id uuid,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.user_access enable row level security;
alter table public.household_limits enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.user_access, public.household_limits, public.admin_audit_log from anon, authenticated;
insert into public.user_access(user_id,owned_households,max_households)
select u.id, count(m.household_id), greatest(1,count(m.household_id)) from auth.users u
left join public.household_members m on m.user_id=u.id and m.role='owner' group by u.id;
insert into public.household_limits(household_id,entry_count,member_count)
select h.id, (select count(*) from public.entries e where e.household_id=h.id),
 (select count(*) from public.household_members m where m.household_id=h.id) from public.households h;

create function public.is_account_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce((select enabled from public.user_access where user_id=auth.uid()),true);
$$;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_account_enabled() and exists(select 1 from public.app_admins where user_id=auth.uid());
$$;
create or replace function public.is_household_member(target_household uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_account_enabled()
 and coalesce((select enabled from public.household_limits where household_id=target_household),true)
 and exists(select 1 from public.household_members where household_id=target_household and user_id=auth.uid());
$$;
create or replace function public.can_edit_household(target_household uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_household_member(target_household) and exists(select 1 from public.household_members
 where household_id=target_household and user_id=auth.uid() and role in ('owner','admin'));
$$;
create function public.get_my_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',public.is_account_enabled(),
 'reason',coalesce((select reason from public.user_access where user_id=auth.uid()),''));
$$;
create function private.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_app_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
end; $$;
create function private.household_writable(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled and subscription_status in ('free','trial','active')
 and (expires_at is null or expires_at > now()) from public.household_limits where household_id=h),false);
$$;
create function private.storage_usage(h uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0)::bigint
 from storage.objects where bucket_id='household-files' and split_part(name,'/',1)=h::text;
$$;
create function private.reserved_usage(h uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(r.bytes),0)::bigint from private.upload_reservations r where r.household_id=h
 and not exists(select 1 from storage.objects o where o.bucket_id='household-files' and o.name=r.path);
$$;
create function private.household_summary(h uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(l) || jsonb_build_object('name',house.name,'storage_bytes',private.storage_usage(h),
 'reserved_bytes',private.reserved_usage(h),'writable',private.household_writable(h),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role)
 order by m.joined_at) from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=h),'[]'::jsonb))
 from public.household_limits l join public.households house on house.id=l.household_id where l.household_id=h;
$$;
create function public.get_household_entitlements(target_household uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_household_member(target_household) then raise exception 'HOUSEHOLD_ACCESS_DENIED' using errcode='42501'; end if;
 return private.household_summary(target_household) - 'members';
end; $$;

-- Trigger guards also cover existing SECURITY DEFINER RPC write paths.
create function private.guard_household_create() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.is_account_enabled() then raise exception 'ACCOUNT_DISABLED' using errcode='42501'; end if;
 return new;
end; $$;
create trigger account_household_guard before insert or update on public.households for each row execute function private.guard_household_create();
create function private.init_household_limits() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.household_limits(household_id) values(new.id);
 return new;
end; $$;
create trigger household_limits_init after insert on public.households for each row execute function private.init_household_limits();

create function private.enforce_entry_limits() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 h := case when tg_op='DELETE' then old.household_id else new.household_id end;
 if auth.uid() is not null and not public.is_account_enabled() then raise exception 'ACCOUNT_DISABLED' using errcode='42501'; end if;
 if tg_op='DELETE' then
  update public.household_limits set entry_count=greatest(0,entry_count-1) where household_id=h;
  return old;
 end if;
 if tg_op='UPDATE' and new.household_id<>old.household_id then raise exception 'HOUSEHOLD_MOVE_NOT_ALLOWED'; end if;
 if not private.household_writable(h) then raise exception 'HOUSEHOLD_READ_ONLY' using errcode='42501'; end if;
 if new.data::text ~ '"data:[^"]*;base64,' then raise exception 'INLINE_UPLOAD_NOT_ALLOWED'; end if;
 if octet_length(new.data::text)>262144 then raise exception 'RECORD_TOO_LARGE'; end if;
 if tg_op='INSERT' then
  update public.household_limits set entry_count=entry_count+1 where household_id=h and entry_count<max_entries;
  if not found then raise exception 'ENTRY_LIMIT_REACHED' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
create trigger entry_limits after insert or update or delete on public.entries for each row execute function private.enforce_entry_limits();

create function private.enforce_member_limits() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid; old_owner boolean := false; new_owner boolean := false;
begin
 h := case when tg_op='DELETE' then old.household_id else new.household_id end;
 if auth.uid() is not null and not public.is_account_enabled() then raise exception 'ACCOUNT_DISABLED' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.household_id<>old.household_id or new.user_id<>old.user_id) then raise exception 'MEMBERSHIP_MOVE_NOT_ALLOWED'; end if;
 if tg_op<>'DELETE' and not private.household_writable(h) and not public.is_app_admin() then raise exception 'HOUSEHOLD_READ_ONLY'; end if;
 if tg_op='INSERT' then
  update public.household_limits set member_count=member_count+1 where household_id=h and member_count<max_members;
  if not found then raise exception 'MEMBER_LIMIT_REACHED'; end if;
 elsif tg_op='DELETE' then
  update public.household_limits set member_count=greatest(0,member_count-1) where household_id=h;
 end if;
 if tg_op<>'INSERT' then old_owner := old.role='owner'; end if;
 if tg_op<>'DELETE' then new_owner := new.role='owner'; end if;
 if new_owner and not old_owner then
  insert into public.user_access(user_id) values(new.user_id) on conflict do nothing;
  update public.user_access set owned_households=owned_households+1 where user_id=new.user_id and owned_households<max_households;
  if not found then raise exception 'HOUSEHOLD_LIMIT_REACHED'; end if;
 elsif old_owner and not new_owner then
  update public.user_access set owned_households=greatest(0,owned_households-1) where user_id=old.user_id;
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger member_limits after insert or update or delete on public.household_members for each row execute function private.enforce_member_limits();
create function private.guard_household_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.is_account_enabled() then raise exception 'ACCOUNT_DISABLED'; end if;
 if tg_op<>'DELETE' and not private.household_writable(new.household_id) then raise exception 'HOUSEHOLD_READ_ONLY'; end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger category_account_guard before insert or update or delete on public.household_categories for each row execute function private.guard_household_write();
create trigger invite_account_guard before insert or update or delete on public.household_invites for each row execute function private.guard_household_write();
create policy account_active_storage on storage.objects as restrictive for all to authenticated
 using(public.is_account_enabled()) with check(public.is_account_enabled());
create policy household_files_server_insert on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'household-files');
create policy household_files_server_update on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'household-files') with check(bucket_id<>'household-files');
create policy account_active_push on public.push_subscriptions as restrictive for all to authenticated
 using(public.is_account_enabled()) with check(public.is_account_enabled());
-- Storage bytes are written ONLY by the upload API after a locked reservation.
create function public.reserve_household_upload(actor uuid,target_household uuid,object_path text,file_bytes bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare lim public.household_limits%rowtype; result uuid;
begin
 if not exists(select 1 from auth.users where id=actor)
 or not coalesce((select enabled from public.user_access where user_id=actor),true)
 or not exists(select 1 from public.household_members where household_id=target_household and user_id=actor) then raise exception 'HOUSEHOLD_ACCESS_DENIED'; end if;
 select * into lim from public.household_limits where household_id=target_household for update;
 if not found or not private.household_writable(target_household) then raise exception 'HOUSEHOLD_READ_ONLY'; end if;
 if not lim.uploads_enabled then raise exception 'UPLOADS_DISABLED'; end if;
 if file_bytes is null or file_bytes<=0 or file_bytes>lim.max_file_bytes then raise exception 'FILE_LIMIT_REACHED'; end if;
 if split_part(object_path,'/',1)<>target_household::text or object_path like '%..%' then raise exception 'INVALID_UPLOAD_PATH'; end if;
 if private.storage_usage(target_household)+private.reserved_usage(target_household)+file_bytes>lim.max_storage_bytes then raise exception 'STORAGE_LIMIT_REACHED'; end if;
 insert into private.upload_reservations(household_id,user_id,path,bytes) values(target_household,actor,object_path,file_bytes) returning id into result;
 return result;
end; $$;
create function public.release_household_upload(reservation_id uuid) returns void language sql security definer set search_path='' as $$
 delete from private.upload_reservations where id=reservation_id;
$$;
revoke all on function public.reserve_household_upload(uuid,uuid,text,bigint), public.release_household_upload(uuid) from public, anon, authenticated;
grant execute on function public.reserve_household_upload(uuid,uuid,text,bigint), public.release_household_upload(uuid) to service_role;

create function public.admin_list_users(search_text text default '',page_number integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform private.require_admin();
 if page_number<0 then raise exception 'INVALID_PAGE'; end if;
 select count(*) into total from auth.users u where position(lower(trim(search_text)) in lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')))>0;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
  select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name','') as display_name,u.created_at,u.last_sign_in_at,
  coalesce(a.enabled,true) as enabled,coalesce(a.max_households,1) as max_households,coalesce(a.reason,'') as reason,
  exists(select 1 from public.app_admins where user_id=u.id) as is_admin,
  (select count(*) from public.household_members where user_id=u.id) as household_count
  from auth.users u left join public.user_access a on a.user_id=u.id
  where position(lower(trim(search_text)) in lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')))>0
  order by u.created_at desc,u.id limit 25 offset page_number*25
 ) x;
 return jsonb_build_object('users',result,'total',total);
end; $$;
create function public.admin_list_households(search_text text default '',page_number integer default 0,target_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform private.require_admin();
 if page_number<0 then raise exception 'INVALID_PAGE'; end if;
 select count(*) into total from public.households h where position(lower(trim(search_text)) in lower(h.name))>0
 and (target_user is null or exists(select 1 from public.household_members m where m.household_id=h.id and m.user_id=target_user));
 select coalesce(jsonb_agg(private.household_summary(x.id)),'[]'::jsonb) into result from (
 select h.id from public.households h where position(lower(trim(search_text)) in lower(h.name))>0
 and (target_user is null or exists(select 1 from public.household_members m where m.household_id=h.id and m.user_id=target_user))
 order by h.created_at desc,h.id limit 25 offset page_number*25) x;
 return jsonb_build_object('houses',result,'total',total);
end; $$;
create function public.admin_set_user_access(target_user uuid,new_enabled boolean,household_limit integer,admin_reason text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 perform pg_advisory_xact_lock(hashtextextended('admin-user-access',0));
 if new_enabled is null or household_limit is null then raise exception 'INVALID_SETTINGS'; end if;
 if not exists(select 1 from auth.users where id=target_user) then raise exception 'USER_NOT_FOUND'; end if;
 if not new_enabled and target_user=auth.uid() then raise exception 'CANNOT_DISABLE_SELF'; end if;
 if not new_enabled and exists(select 1 from public.app_admins where user_id=target_user)
 and not exists(select 1 from public.app_admins a left join public.user_access u on u.user_id=a.user_id where a.user_id<>target_user and coalesce(u.enabled,true)) then raise exception 'LAST_ADMIN_REQUIRED'; end if;
 insert into public.user_access(user_id,enabled,max_households,reason) values(target_user,new_enabled,household_limit,coalesce(admin_reason,''))
 on conflict(user_id) do update set enabled=excluded.enabled,max_households=excluded.max_households,reason=excluded.reason,updated_at=now();
 insert into public.admin_audit_log(actor_id,action,target_id,details) values(auth.uid(),'user_access',target_user,jsonb_build_object('enabled',new_enabled,'max_households',household_limit,'reason',admin_reason));
end; $$;
create function public.admin_save_household(target_household uuid,settings jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if nullif(trim(settings->>'name'),'') is null or length(trim(settings->>'name'))>60 then raise exception 'INVALID_HOUSEHOLD_NAME'; end if;
 update public.household_limits set enabled=(settings->>'enabled')::boolean,plan_key=trim(settings->>'plan_key'),
 subscription_status=settings->>'subscription_status',expires_at=nullif(settings->>'expires_at','')::timestamptz,
 uploads_enabled=(settings->>'uploads_enabled')::boolean,max_storage_bytes=(settings->>'max_storage_bytes')::bigint,
 max_file_bytes=(settings->>'max_file_bytes')::bigint,max_entries=(settings->>'max_entries')::integer,
 max_members=(settings->>'max_members')::integer,updated_at=now() where household_id=target_household;
 if not found then raise exception 'HOUSEHOLD_NOT_FOUND'; end if;
 update public.households set name=trim(settings->>'name') where id=target_household;
 insert into public.admin_audit_log(actor_id,action,target_id,details) values(auth.uid(),'household_settings',target_household,settings);
end; $$;
create function public.admin_manage_member(target_household uuid,target_user uuid,next_role text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role text;
begin
 perform private.require_admin();
 perform 1 from public.household_limits where household_id=target_household for update;
 if not found then raise exception 'HOUSEHOLD_NOT_FOUND'; end if;
 if next_role not in ('owner','admin','member','remove') or next_role is null then raise exception 'INVALID_ROLE'; end if;
 select role into previous_role from public.household_members where household_id=target_household and user_id=target_user;
 if previous_role='owner' and next_role<>'owner' and (select count(*) from public.household_members where household_id=target_household and role='owner')<=1 then raise exception 'LAST_OWNER_REQUIRED'; end if;
 if next_role='remove' then
  delete from public.household_members where household_id=target_household and user_id=target_user;
 else
  insert into public.household_members(household_id,user_id,role) values(target_household,target_user,next_role)
  on conflict(household_id,user_id) do update set role=excluded.role;
 end if;
 insert into public.admin_audit_log(actor_id,action,target_id,details) values(auth.uid(),'household_member',target_household,jsonb_build_object('user_id',target_user,'old_role',previous_role,'new_role',next_role));
end; $$;
create function public.admin_create_household(owner_user uuid,house_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_admin();
 if nullif(trim(house_name),'') is null or length(trim(house_name))>60 then raise exception 'INVALID_HOUSEHOLD_NAME'; end if;
 insert into public.households(name,created_by) values(trim(house_name),owner_user) returning id into result;
 insert into public.household_members(household_id,user_id,role) values(result,owner_user,'owner');
 insert into public.admin_audit_log(actor_id,action,target_id,details) values(auth.uid(),'household_created',result,jsonb_build_object('owner',owner_user));
 return result;
end; $$;
create function public.admin_recent_audit() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select a.*,u.email as actor_email from public.admin_audit_log a left join auth.users u on u.id=a.actor_id order by a.id desc limit 50) x);
end; $$;
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_account_enabled','get_my_access','get_household_entitlements','admin_list_users','admin_list_households','admin_set_user_access','admin_save_household','admin_manage_member','admin_create_household','admin_recent_audit')
 loop
  execute format('revoke all on function %s from public, anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
create function public.unused_household_files(target_household uuid,candidate_paths text[])
returns setof text language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_household_member(target_household) then raise exception 'HOUSEHOLD_ACCESS_DENIED'; end if;
 if cardinality(candidate_paths)>100 then raise exception 'TOO_MANY_PATHS'; end if;
 return query select distinct path from unnest(candidate_paths) path
 where split_part(path,'/',1)=target_household::text
 and not exists(select 1 from public.entries e where e.household_id=target_household
 and jsonb_path_exists(e.data,'$.** ? (@ == $asset)',jsonb_build_object('asset','storage:'||path)));
end; $$;
revoke all on function public.unused_household_files(uuid,text[]) from public,anon;
grant execute on function public.unused_household_files(uuid,text[]) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;

-- Match the upload endpoint's transport ceiling; household limits can be lower.
update storage.buckets set file_size_limit=3145728 where id='household-files';
create function public.admin_orphan_files(target_household uuid) returns setof text language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return query select candidates.path from (
  select o.name as path from storage.objects o where o.bucket_id='household-files'
   and split_part(o.name,'/',1)=target_household::text and o.created_at<now()-interval '24 hours'
  union select r.path from private.upload_reservations r where r.household_id=target_household and r.created_at<now()-interval '24 hours'
 ) candidates where not exists(select 1 from public.entries e where e.household_id=target_household
 and jsonb_path_exists(e.data,'$.** ? (@ == $asset)',jsonb_build_object('asset','storage:'||candidates.path)))
 limit 100;
end; $$;
create function public.finish_orphan_cleanup(actor uuid,target_household uuid,removed_paths text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.upload_reservations where household_id=target_household and path=any(removed_paths);
 insert into public.admin_audit_log(actor_id,action,target_id,details) values(actor,'orphan_cleanup',target_household,jsonb_build_object('count',cardinality(removed_paths)));
end; $$;
revoke all on function public.admin_orphan_files(uuid) from public,anon;
grant execute on function public.admin_orphan_files(uuid) to authenticated;
revoke all on function public.finish_orphan_cleanup(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.finish_orphan_cleanup(uuid,uuid,text[]) to service_role;
-- The cron uses the service role, so it must explicitly omit disabled accounts/homes.
create function public.active_notification_members()
returns table(household_id uuid,user_id uuid) language sql stable security definer set search_path='' as $$
 select m.household_id,m.user_id from public.household_members m
 join public.household_limits l on l.household_id=m.household_id and l.enabled
 left join public.user_access a on a.user_id=m.user_id where coalesce(a.enabled,true);
$$;
revoke all on function public.active_notification_members() from public,anon,authenticated;
grant execute on function public.active_notification_members() to service_role;
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
  if current_user_id is null or not public.is_account_enabled() then
    raise exception 'ACCOUNT_DISABLED';
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

commit;
