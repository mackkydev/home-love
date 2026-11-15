import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const limits=loadTs('src/lib/usage-limits.ts',{});
const house='00000000-0000-4000-8000-000000000001', item='00000000-0000-4000-8000-000000000002';
function setup({reserveError=null,uploadError=null,cleanupError=null,authError=null}={}) {
  const calls=[];
  const client={auth:{getUser:async token=>{calls.push(['auth',token]);return {data:{user:{id:'verified-user'}},error:authError};}},
    rpc:async(name,args)=>{calls.push([name,args]);return name==='reserve_household_upload'?{data:'reservation-id',error:reserveError}:{error:null};},
    storage:{from:()=>({upload:async(path,file)=>{calls.push(['upload',path,file.size]);return {error:uploadError};},remove:async(paths)=>{calls.push(['remove',paths]);return {error:cleanupError};}})}
  };
  const route=loadTs('src/app/api/household-files/route.ts',{'@supabase/supabase-js':{createClient:()=>client},'@/lib/usage-limits':limits},
    {process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',SUPABASE_SECRET_KEY:'server-only'}}});
  return {route,calls};
}
function request(){const data=new FormData();data.set('householdId',house);data.set('entryId',item);data.set('file',new Blob(['bytes'],{type:'image/jpeg'}),'a.jpg');return new Request('https://app.invalid/api/household-files',{method:'POST',headers:{Authorization:'Bearer test-token'},body:data});}
test('upload verifies the token and reserves actual file length before writing',async()=>{
  const x=setup();const result=await x.route.POST(request());assert.equal(result.status,200);
  assert.deepEqual(x.calls.map(c=>c[0]),['auth','reserve_household_upload','upload','release_household_upload']);
  assert.equal(x.calls[1][1].actor,'verified-user');assert.equal(x.calls[1][1].file_bytes,5);
});
test('no token, invalid session and exceeded quotas cannot upload',async()=>{
  const a=setup();assert.equal((await a.route.POST(new Request('https://app.invalid',{method:'POST'}))).status,401);
  assert.equal(a.calls.length,0);
  const b=setup({authError:{message:'invalid'}});assert.equal((await b.route.POST(request())).status,401);
  const c=setup({reserveError:{message:'STORAGE_LIMIT_REACHED'}});assert.equal((await c.route.POST(request())).status,403);assert.ok(!c.calls.some(x=>x[0]==='upload'));
});
test('failed uploads are removed before releasing reserved bytes',async()=>{
  const x=setup({uploadError:{message:'timeout'}});assert.equal((await x.route.POST(request())).status,502);
  assert.ok(x.calls.findIndex(c=>c[0]==='remove')<x.calls.findIndex(c=>c[0]==='release_household_upload'));
});
test('uncertain failed cleanup retains quota reservation',async()=>{
  const x=setup({uploadError:{message:'timeout'},cleanupError:{message:'offline'}});await x.route.POST(request());
  assert.ok(!x.calls.some(c=>c[0]==='release_household_upload'));
});
test('body-size cap works without trusting Content-Length',async()=>{
  const x=setup();const req=new Request('https://app.invalid',{method:'POST',headers:{Authorization:'Bearer test-token'},body:new Uint8Array(limits.MAX_UPLOAD_BYTES+128*1024+1)});
  assert.equal((await x.route.POST(req)).status,413);assert.ok(!x.calls.some(c=>c[0]==='reserve_household_upload'));
});
