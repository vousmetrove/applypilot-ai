import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {claimDevice,hashSecret,newSecret} from '../lib/pairing-core.mjs';
const migrations=await Promise.all(['0000_long_crusher_hogan','0001_sleepy_mach_iv','0002_uneven_outlaw_kid'].map(name=>readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8')));
const now=new Date('2030-01-01T00:00:00Z');
async function setup(status='approved',expires='2030-01-01T00:10:00Z') {
  const sqlite=new DatabaseSync(':memory:');migrations.forEach(sql=>sqlite.exec(sql));
  const secret=newSecret(),id='simulated-device',code='12345678';
  sqlite.prepare('INSERT INTO device_pairings (id,user_id,code_hash,claim_secret_hash,status,expires_at) VALUES (?,?,?,?,?,?)').run(id,'simulated-user',await hashSecret(`${id}:${code}`),await hashSecret(secret),status,expires);
  const db={prepare:sql=>({bind:(...values)=>({
    first:async()=>sqlite.prepare(sql).get(...values)||null,
    run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}),
  })})};
  return {sqlite,db,secret,id,code};
}
test('QR code alone cannot claim a device and pending pairing grants no token',async()=>{
  const f=await setup('pending');try {
    assert.equal((await claimDevice(f.db,f.id,f.code,'',now)).status,403);
    assert.equal((await claimDevice(f.db,f.id,f.code,newSecret(),now)).status,403);
    const pending=await claimDevice(f.db,f.id,f.code,f.secret,now);assert.equal(pending.status,202);assert.equal(pending.body.token,undefined);
  }finally{f.sqlite.close();}
});
test('concurrent claims produce exactly one token and replays do not revoke active device',async()=>{
  const f=await setup();try {
    const results=await Promise.all(Array.from({length:5},()=>claimDevice(f.db,f.id,f.code,f.secret,now)));
    const success=results.filter(r=>r.status===200);assert.equal(success.length,1);
    assert.equal(success[0].body.token.length,43);assert.notEqual(success[0].body.token,await hashSecret(`${f.id}:${f.code}:applypilot-device-token:v1`));
    const row=f.sqlite.prepare('SELECT * FROM device_pairings').get();assert.equal(row.token_hash,await hashSecret(success[0].body.token));assert.equal(row.claim_secret_hash,null);
    assert.notEqual((await claimDevice(f.db,f.id,f.code,f.secret,new Date('2030-01-02'))).status,200);
    assert.equal(f.sqlite.prepare('SELECT status FROM device_pairings').get().status,'active');
  }finally{f.sqlite.close();}
});
test('expired and revoked pairings cannot be claimed',async()=>{
  for(const [status,expires,expected] of [['approved','2029-01-01T00:00:00Z',410],['revoked','2030-01-01T00:10:00Z',409]]) {
    const f=await setup(status,expires);try{assert.equal((await claimDevice(f.db,f.id,f.code,f.secret,now)).status,expected);}finally{f.sqlite.close();}
  }
});
