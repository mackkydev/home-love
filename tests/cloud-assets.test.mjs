import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const limits=loadTs('src/lib/usage-limits.ts',{});
function setup({unused,upsertError=null,failUpload=false}={}){
  const calls=[];
  const client={auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})},
    from:table=>({
      upsert:async rows=>{calls.push(['upsert',table,rows]);return {error:upsertError};},
      delete:()=>({eq:()=>({in:async()=>{calls.push(['delete',table]);return {error:null};}})})
    }),
    rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:unused??args.candidate_paths,error:null};},
    storage:{from:()=>({remove:async paths=>{calls.push(['remove',paths]);return {error:null};}})}
  };
  const lib=loadTs('src/lib/cloud.ts',{'@supabase/supabase-js':{createClient:()=>client},'./usage-limits':limits},{
    process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'}},
    fetch:async(url,options)=>{
      if(String(url).startsWith('data:'))return {blob:async()=>new Blob(['photo'],{type:'image/jpeg'})};
      calls.push(['upload',options.body.get('householdId')]);
      return {ok:!failUpload,json:async()=>failUpload?{error:'failed'}:{path:'home/item/new.jpg'}};
    }
  });
  return {lib,calls};
}
const previous=data=>({entries:[data],categories:[],entryVersions:new Map([[data.id,JSON.stringify(data)]]),categoryVersions:new Map()});
test('deleting an item removes actual unused files only after row deletion',async()=>{
  const x=setup();await x.lib.saveHousehold('home',[],[],previous({id:'item',photo:'storage:home/item/old.jpg'}));
  assert.ok(x.calls.findIndex(c=>c[0]==='delete')<x.calls.findIndex(c=>c[0]==='remove'));
  assert.deepEqual(x.calls.find(c=>c[0]==='remove')[1],['home/item/old.jpg']);
});
test('replacing a photo uploads and saves the new reference before deleting the old file',async()=>{
  const x=setup();await x.lib.saveHousehold('home',[{id:'item',photo:'data:image/jpeg;base64,AAAA'}],[],previous({id:'item',photo:'storage:home/item/old.jpg'}));
  assert.deepEqual(x.calls.filter(c=>['upload','upsert','remove'].includes(c[0])).map(c=>c[0]),['upload','upsert','remove']);
  assert.deepEqual(x.calls.find(c=>c[0]==='remove')[1],['home/item/old.jpg']);
});
test('server-confirmed shared files are kept',async()=>{
  const x=setup({unused:[]});await x.lib.saveHousehold('home',[],[],previous({id:'item',photo:'storage:home/item/shared.jpg'}));
  assert.equal(x.calls.filter(c=>c[0]==='remove').length,0);
});
test('failed save cleans new unreferenced upload, never the old photo',async()=>{
  const x=setup({upsertError:{message:'ENTRY_LIMIT_REACHED'}});
  await assert.rejects(x.lib.saveHousehold('home',[{id:'item',photo:'data:image/jpeg;base64,AAAA'}],[],previous({id:'item',photo:'storage:home/item/old.jpg'})));
  assert.deepEqual(x.calls.find(c=>c[0]==='remove')[1],['home/item/new.jpg']);
});
test('uncertain save that committed is protected by persisted-reference check',async()=>{
  const x=setup({upsertError:{message:'timeout'},unused:[]});
  await assert.rejects(x.lib.saveHousehold('home',[{id:'item',photo:'data:image/jpeg;base64,AAAA'}],[],previous({id:'item',photo:'storage:home/item/old.jpg'})));
  assert.equal(x.calls.filter(c=>c[0]==='remove').length,0);
});
