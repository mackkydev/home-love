import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migration = await readFile(new URL('../supabase/migrations/20261125000000_repair_device_pin.sql', import.meta.url), 'utf8');
const original = await readFile(new URL('../supabase/migrations/20261010040000_device_pin.sql', import.meta.url), 'utf8');
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
async function setup(schema) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${user}'),('${other}');
    create extension pgcrypto with schema ${schema};
    set search_path = public, extensions;`);
  return db;
}
async function actor(db, id) {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function value(db, sql, args = []) { return Object.values((await db.query(sql, args)).rows[0])[0]; }

test('repairs the broken PIN search path and preserves existing PINs and lockouts', async () => {
  const db = await setup('extensions');
  try {
    await db.exec(original);
    await db.query(`insert into private.device_pins(user_id,pin_hash,fingerprint)
      select $1, extensions.crypt('012345',extensions.gen_salt('bf',4)),
      extensions.hmac(convert_to('012345','UTF8'),secret,'sha256') from private.pin_key`, [user]);
    await actor(db, user);
    await assert.rejects(db.query("select public.verify_device_pin('012345')"), /function crypt.*does not exist/);
    await assert.rejects(db.query("select public.set_device_pin('123456','012345')"), /function crypt.*does not exist/);
    await db.exec('reset role');
    const secret = await value(db, "select encode(secret,'hex') from private.pin_key");
    await db.exec(migration);
    await db.exec(migration);
    assert.equal(await value(db, "select encode(secret,'hex') from private.pin_key"), secret);
    await actor(db, user);
    assert.equal(await value(db, 'select public.has_device_pin()'), true);
    assert.equal(await value(db, "select public.verify_device_pin('012345')"), true);
    assert.equal(await value(db, "select public.set_device_pin('123456','000000')"), false);
    assert.equal(await value(db, "select public.set_device_pin('123456','012345')"), true);
    assert.equal(await value(db, "select public.verify_device_pin('123456')"), true);
    await actor(db, other);
    assert.equal(await value(db, 'select public.has_device_pin()'), false);
    assert.equal(await value(db, "select public.set_device_pin('123456')"), false);
    await actor(db, user);
    for (let i = 0; i < 5; i++) assert.equal(await value(db, "select public.verify_device_pin('999999')"), false);
    assert.equal(await value(db, "select public.verify_device_pin('123456')"), false);
    await assert.rejects(db.query('select * from private.device_pins'), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select public.has_device_pin()'), /permission denied/);
  } finally { await db.close(); }
});

test('installs missing PIN tables and works with pgcrypto in public', async () => {
  const db = await setup('public');
  try {
    await db.exec(migration);
    await actor(db, user);
    assert.equal(await value(db, 'select public.has_device_pin()'), false);
    assert.equal(await value(db, "select public.set_device_pin('012345')"), true);
    assert.equal(await value(db, 'select public.has_device_pin()'), true);
    assert.equal(await value(db, "select public.verify_device_pin('012345')"), true);
    assert.equal(await value(db, 'select public.verify_device_pin(null)'), false);
  } finally { await db.close(); }
});
