export async function hashSecret(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function newSecret() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function claimDevice(db,id,code,secret,now=new Date()) {
  if(typeof secret!=='string'||secret.length!==43)return {status:403,body:{error:'缺少设备领取凭证，请重新生成配对码。'}};
  const codeHash=await hashSecret(`${id}:${code}`),secretHash=await hashSecret(secret);
  const pairing=await db.prepare('SELECT id, status, expires_at, device_name FROM device_pairings WHERE id = ? AND code_hash = ? AND claim_secret_hash = ? LIMIT 1').bind(id,codeHash,secretHash).first();
  if(!pairing)return {status:403,body:{error:'配对凭证无效，请重新配对。'}};
  if(!['pending','approved'].includes(pairing.status))return {status:409,body:{error:'配对已领取或撤销，请重新配对。'}};
  if(new Date(pairing.expires_at).getTime()<=now.getTime())return {status:410,body:{error:'配对码已过期。'}};
  if(pairing.status==='pending')return {status:202,body:{status:'pending'}};
  const token=newSecret(),tokenHash=await hashSecret(token);
  const result=await db.prepare("UPDATE device_pairings SET token_hash = ?, status = 'active', last_seen_at = ?, claim_secret_hash = NULL WHERE id = ? AND status = 'approved' AND claim_secret_hash = ? AND expires_at > ?").bind(tokenHash,now.toISOString(),id,secretHash,now.toISOString()).run();
  if(result.meta.changes!==1)return {status:409,body:{error:'配对状态已变化，请重新配对。'}};
  return {status:200,body:{status:'active',token,pairingId:id,deviceName:pairing.device_name}};
}
