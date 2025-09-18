import crypto from 'crypto';

export const Config = {
  SIMHASH_SIM_THRESHOLD: Number(process.env.SIMHASH_SIM_THRESHOLD ?? 0.85),
  MAX_RECENT: Number(process.env.MAX_RECENT ?? 15),
  TEMPLATE_COOLDOWN_MS: Number(process.env.TEMPLATE_COOLDOWN_MS ?? 7*24*3600*1000),
  EXACT_COMBO_BLOCK_DAYS: Number(process.env.EXACT_COMBO_BLOCK_DAYS ?? 30),
  MAX_ATTEMPTS: Number(process.env.MAX_ATTEMPTS ?? 3)
};

const store = {
  readingsByUser: new Map(),
  tplUsage: new Map()
};

export function tokenize(text){
  return text.toLowerCase().replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/gi,' ').split(/\s+/).filter(Boolean);
}
export function tokenHash64(tok){
  const h = crypto.createHash('blake2b512').update(tok).digest();
  const v = h.subarray(0,8);
  return BigInt('0x' + v.toString('hex'));
}
export function simhash64(text){
  const bits = new Array(64).fill(0);
  for (const t of tokenize(text)){
    const hv = tokenHash64(t);
    for (let i=0;i<64;i++){
      const bit = (hv >> BigInt(i)) & 1n;
      bits[i] += bit===1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let i=0;i<64;i++) if (bits[i]>=0) out |= (1n << BigInt(i));
  return out;
}
export function simSimilarity(a,b){
  let x = a ^ b; let d=0;
  while (x){ x &= (x-1n); d++; }
  return 1 - d/64;
}
export function getRecent(userId, limit=Config.MAX_RECENT){
  const arr = store.readingsByUser.get(userId) || [];
  return arr.slice(-limit);
}
export function saveReading(userId, rec){
  const arr = store.readingsByUser.get(userId) || [];
  arr.push(rec);
  store.readingsByUser.set(userId, arr);
}
export function tplCooldownOK(userId, tplId, now){
  const key = `${userId}:${tplId}`;
  const last = store.tplUsage.get(key) || 0;
  return (now - last) >= Config.TEMPLATE_COOLDOWN_MS;
}
export function markTpl(userId, tplId, now){
  store.tplUsage.set(`${userId}:${tplId}`, now);
}
export function isRecentExactCombo(userId, symbolPerm, now){
  const cutoff = now - Config.EXACT_COMBO_BLOCK_DAYS*24*3600*1000;
  return getRecent(userId, 200).some(r => r.createdAt >= cutoff && r.symbolPerm === symbolPerm);
}
export function tooSimilar(userId, textHash){
  return getRecent(userId).some(r => simSimilarity(textHash, r.textHash) >= Config.SIMHASH_SIM_THRESHOLD);
}
export function makeSeed(userId){
  const base = `${userId}:${new Date().toISOString().slice(0,10)}`;
  const h = crypto.createHash('sha256').update(base).digest('hex').slice(0,8);
  return parseInt(h,16) >>> 0;
}