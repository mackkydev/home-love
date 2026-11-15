import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/password-clipboard.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createClipboardLease}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function setup(permission=true) {
  let now=0, text='', timer; const writes=[];
  const port={writeText:async(value)=>{text=value;writes.push(value);},readText:async()=>text};
  const lease=createClipboardLease(port,async()=>permission,{now:()=>now,schedule:fn=>{timer=fn;return 1;},cancel:()=>{timer=null;}});
  return {lease,port,writes,setTime:n=>{now=n;},setText:value=>{text=value;},getText:()=>text,runTimer:()=>timer?.()};
}
test('copy remains before deadline and clears at 60 seconds',async()=>{
  const x=setup();await x.lease.copy('test-password');x.setTime(59999);await x.lease.expire();assert.equal(x.getText(),'test-password');
  x.setTime(60000);await x.lease.expire();assert.equal(x.getText(),'');assert.equal(x.lease.getState().status,'cleared');
});
test('never clears text subsequently copied from another source',async()=>{
  const x=setup();await x.lease.copy('test-password');x.setText('other-text');x.setTime(60000);await x.lease.expire();assert.equal(x.getText(),'other-text');assert.equal(x.lease.getState().status,'changed');
});
test('denied automatic access leaves an honest manual-clear state',async()=>{
  const x=setup(false);await x.lease.copy('test-password');x.setTime(60000);await x.lease.expire();assert.equal(x.lease.getState().status,'blocked');assert.equal(x.getText(),'test-password');
  await x.lease.clear();assert.equal(x.getText(),'');assert.equal(x.lease.getState().status,'cleared');
});
test('copying again renews deadline; delayed background callback uses absolute time',async()=>{
  const x=setup();await x.lease.copy('first');x.setTime(30000);await x.lease.copy('second');x.setTime(60000);await x.lease.expire();assert.equal(x.getText(),'second');
  x.setTime(180000);await x.lease.expire();assert.equal(x.getText(),'');
});
test('old pending clipboard read cannot clear a newer copied password',async()=>{
  const x=setup();await x.lease.copy('first');let finish;
  x.port.readText=()=>new Promise(resolve=>{finish=resolve;});x.setTime(60000);
  const expired=x.lease.expire();await Promise.resolve();await x.lease.copy('second');finish('first');await expired;
  assert.equal(x.getText(),'second');assert.equal(x.lease.getState().status,'copied');
});
test('clipboard write errors are surfaced; state and subscribers never contain passwords',async()=>{
  const x=setup();const snapshots=[];x.lease.subscribe(s=>snapshots.push(s));
  await x.lease.copy('private-value');assert.ok(!JSON.stringify(snapshots).includes('private-value'));
  x.port.writeText=async()=>{throw new Error('denied');};await x.lease.copy('another-value');assert.equal(x.lease.getState().status,'blocked');
});
