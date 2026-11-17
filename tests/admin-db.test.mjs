import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const admin = '00000000-0000-4000-8000-000000000001';
const user = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
let house;
const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const actor = async (id, role='authenticated') => {
  await db.exec(`reset role; set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const value = async (sql, args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
const settings = { name: 'Test household', enabled: true, plan_key: 'free', subscription_status: 'free', expires_at: null,
  uploads_enabled: true, max_storage_bytes: 20971520, max_file_bytes: 1048576, max_entries: 2, max_members: 2 };
const configure = async patch => {
  await actor(admin);
  await db.query('select public.admin_save_household($1,$2)',[house, {...settings,...patch}]);
};
const entry = (id, data={}) => db.query('insert into public.entries(id,household_id,data) values($1,$2,$3)',[id,house,{id,...data}]);

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email varchar(255),raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now());
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    grant all on storage.objects to authenticated,service_role;
  `);
  for (const name of ['20261010000000_initial.sql','20261010010000_household_invites.sql','20261010020000_admin_signup_control.sql',
    '20261010030000_signup_methods.sql','20261010040000_unique_default_household_names.sql','20261010_push_notifications.sql',
    '20261011010000_household_member_management.sql']) {
    await db.exec((await migration(name)).replace('create extension if not exists pgcrypto;',''));
  }
  await db.exec('grant all on all tables in schema public to authenticated,service_role');
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[admin,'admin@test.invalid',user,'user@test.invalid',outsider,'outside@test.invalid']);
  await db.query('insert into public.app_admins(user_id) values($1)',[admin]);
  // Test migration backfill against an existing household and existing record.
  await actor(user);
  house = await value('select public.ensure_personal_household()');
  await entry('10000000-0000-4000-8000-000000000001');
  await db.exec('reset role');
  await db.exec(await migration('20261113000000_admin_accounts_quotas.sql'));
});
after(async()=>db.close());

test('migration backfills counts, admin can list; members cannot administer or change quotas', async()=>{
  await actor(admin);
  const data=await value('select public.admin_list_households()');
  assert.equal(data.houses[0].entry_count,1);
  assert.equal(data.houses[0].member_count,1);
  assert.equal(data.houses[0].max_storage_bytes,20971520);
  assert.equal((await value('select public.admin_list_users()')).total,3);
  await actor(user);
  await assert.rejects(db.query('select public.admin_list_users()'),/ADMIN_REQUIRED/);
  await assert.rejects(db.query('update public.household_limits set max_entries=999'),/permission denied/);
  await actor(outsider);
  await assert.rejects(db.query('select public.get_household_entitlements($1)',[house]),/HOUSEHOLD_ACCESS_DENIED/);
});
test('record quotas handle inserts, upserts, deletes and prevent direct inline uploads',async()=>{
  await configure({});await actor(user);
  const id='10000000-0000-4000-8000-000000000002';
  await entry(id);
  await assert.rejects(entry('10000000-0000-4000-8000-000000000003'),/ENTRY_LIMIT_REACHED/);
  await db.query("insert into public.entries(id,household_id,data) values($1,$2,'{}') on conflict(id) do update set data=excluded.data",[id,house]);
  assert.equal((await value('select public.get_household_entitlements($1)',[house])).entry_count,2);
  await db.query('delete from public.entries where id=$1',[id]);
  await assert.rejects(entry(id,{photo:'data:image/jpeg;base64,AAAA'}),/INLINE_UPLOAD_NOT_ALLOWED/);
  await entry(id);
  assert.equal((await value('select public.get_household_entitlements($1)',[house])).entry_count,2);
});
test('expired plans allow reads and deletion, reject edits, additions and category writes',async()=>{
  await configure({expires_at:'2020-01-01T00:00:00Z'});await actor(user);
  assert.equal((await db.query('select * from public.entries')).rows.length,2);
  await assert.rejects(db.query("update public.entries set data='{}'"),/HOUSEHOLD_READ_ONLY/);
  await assert.rejects(entry('10000000-0000-4000-8000-000000000003'),/HOUSEHOLD_READ_ONLY/);
  await assert.rejects(db.query("insert into public.household_categories(household_id,name) values($1,'new')",[house]),/HOUSEHOLD_READ_ONLY/);
  await db.query('delete from public.entries where id=$1',['10000000-0000-4000-8000-000000000002']);
  await configure({});
});
test('disabled accounts lose RLS access and RPC write access; re-enable restores access',async()=>{
  await actor(admin);
  await assert.rejects(db.query('select public.admin_set_user_access($1,false,1,$2)',[admin,'test']),/CANNOT_DISABLE_SELF/);
  await db.query('select public.admin_set_user_access($1,false,1,$2)',[user,'Suspended']);
  await actor(user);
  assert.equal((await value('select public.get_my_access()')).enabled,false);
  assert.equal((await db.query('select * from public.entries')).rows.length,0);
  await assert.rejects(db.query('select public.ensure_personal_household()'),/ACCOUNT_DISABLED/);
  await assert.rejects(db.query('select public.create_household_invite($1)',[house]));
  await actor(admin);await db.query('select public.admin_set_user_access($1,true,1,$2)',[user,'']);
  await actor(user);assert.equal((await db.query('select * from public.entries')).rows.length,1);
});
test('member and owned-home limits, last-owner protection and rollback',async()=>{
  await actor(admin);
  await assert.rejects(db.query('select public.admin_create_household($1,$2)',[user,'Extra house']),/HOUSEHOLD_LIMIT_REACHED/);
  await db.query('select public.admin_manage_member($1,$2,$3)',[house,outsider,'member']);
  await assert.rejects(db.query('select public.admin_manage_member($1,$2,$3)',[house,admin,'member']),/MEMBER_LIMIT_REACHED/);
  await assert.rejects(db.query('select public.admin_manage_member($1,$2,$3)',[house,user,'remove']),/LAST_OWNER_REQUIRED/);
  await db.query('select public.admin_manage_member($1,$2,$3)',[house,outsider,'remove']);
  assert.equal((await value('select public.admin_list_households()')).houses.length,1);
});
test('upload reservations serialize total usage; clients cannot reserve or bypass upload API',async()=>{
  await db.exec('reset role');
  assert.equal(await value("select relrowsecurity from pg_class where oid='private.upload_reservations'::regclass"),true);
  await configure({max_storage_bytes:100,max_file_bytes:80});await actor(user);
  await assert.rejects(db.query('select * from private.upload_reservations'),/permission denied/);
  await assert.rejects(db.query('select public.reserve_household_upload($1,$2,$3,70)',[user,house,house+'/a.jpg']),/permission denied/);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('household-files',$1,'{\"size\":70}')",[house+'/a.jpg']),/row-level security/);
  await actor('', 'service_role');
  const id=await value('select public.reserve_household_upload($1,$2,$3,70)',[user,house,house+'/a.jpg']);
  await assert.rejects(db.query('select public.reserve_household_upload($1,$2,$3,31)',[user,house,house+'/b.jpg']),/STORAGE_LIMIT_REACHED/);
  await assert.rejects(db.query('select public.reserve_household_upload($1,$2,$3,81)',[user,house,house+'/c.jpg']),/FILE_LIMIT_REACHED/);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('household-files',$1,'{\"size\":70}')",[house+'/a.jpg']);
  // A reservation with an existing object counts only once.
  const next=await value('select public.reserve_household_upload($1,$2,$3,30)',[user,house,house+'/b.jpg']);
  await db.query('select public.release_household_upload($1)',[next]);
  await db.query('select public.release_household_upload($1)',[id]);
  await configure({uploads_enabled:false});await actor('','service_role');
  await assert.rejects(db.query('select public.reserve_household_upload($1,$2,$3,1)',[user,house,house+'/c.jpg']),/UPLOADS_DISABLED/);
  await configure({});
});
test('image cleanup preserves shared/nested references, detects replaced and deleted images',async()=>{
  await actor(user);
  const a=house+'/a.jpg', b=house+'/b.jpg';
  await db.query('update public.entries set data=$1 where household_id=$2',[{photos:['storage:'+a],attachments:[{data:'storage:'+b}]},house]);
  assert.deepEqual((await db.query('select public.unused_household_files($1,$2)',[house,[a,b,house+'/unused.jpg']])).rows.map(r=>r.unused_household_files),[house+'/unused.jpg']);
  await entry('10000000-0000-4000-8000-000000000004',{photo:'storage:'+a});
  await db.query("update public.entries set data='{}' where id=$1",['10000000-0000-4000-8000-000000000001']);
  assert.deepEqual((await db.query('select public.unused_household_files($1,$2)',[house,[a,b]])).rows.map(r=>r.unused_household_files),[b]);
  await db.query('delete from public.entries where id=$1',['10000000-0000-4000-8000-000000000004']);
  assert.equal((await db.query('select public.unused_household_files($1,$2)',[house,[a,b]])).rows.length,2);
});

test('notification dispatch excludes disabled users and homes; only service role can list recipients',async()=>{
  await actor(user);
  await assert.rejects(db.query('select * from public.active_notification_members()'),/permission denied/);
  await actor('', 'service_role');
  assert.equal((await db.query('select * from public.active_notification_members()')).rows.length,1);
  await actor(admin);
  await db.query('select public.admin_set_user_access($1,false,1,$2)',[user,'Suspended']);
  await actor('', 'service_role');
  assert.equal((await db.query('select * from public.active_notification_members()')).rows.length,0);
  await actor(admin);
  await db.query('select public.admin_set_user_access($1,true,1,$2)',[user,'']);
  await configure({enabled:false});
  await actor(user);
  assert.equal((await db.query('select * from public.entries')).rows.length,0);
  await actor('', 'service_role');
  assert.equal((await db.query('select * from public.active_notification_members()')).rows.length,0);
  await configure({});
});

test('admin recovery only returns old unreferenced files in the selected household',async()=>{
  await actor('', 'service_role');
  for (const [path,age] of [[house+'/old.jpg','2 days'],[house+'/recent.jpg','1 hour'],[house+'/shared.jpg','2 days'],[outsider+'/other.jpg','2 days']]) {
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('household-files',$1,'{\"size\":1}',now()-$2::interval)",[path,age]);
  }
  await actor(user);
  await db.query('update public.entries set data=$1 where household_id=$2',[{photo:'storage:'+house+'/shared.jpg'},house]);
  await assert.rejects(db.query('select public.admin_orphan_files($1)',[house]),/ADMIN_REQUIRED/);
  await actor(admin);
  assert.deepEqual((await db.query('select public.admin_orphan_files($1)',[house])).rows.map(r=>r.admin_orphan_files),[house+'/old.jpg']);
});
