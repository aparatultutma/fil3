import express from 'express';
import cors from 'cors';
import fs from 'fs';
import {
  Config, simhash64, tooSimilar, saveReading,
  isRecentExactCombo, makeSeed, tplCooldownOK, markTpl
} from './noRepeatGuard.js';

const app = express();
app.use(cors());
app.use(express.json());

const symbols = JSON.parse(fs.readFileSync('./symbols_hikayeli_v1.json','utf-8')).symbols;
const notesRaw = JSON.parse(fs.readFileSync('./symbols_with_culture_notes.json','utf-8'));
const cultureNotes = {};
for (const s of (notesRaw.symbols || [])){
  for (const n of (s.culture_notes || [])){
    cultureNotes[s.symbol] ||= [];
    cultureNotes[s.symbol].push({ tr: n.note_tr, en: n.note_en, id: n.note_id, allow: n.allow || ['GLOBAL'] });
  }
}
const bySymbol = Object.fromEntries(symbols.map(s => [s.symbol, s]));

function pickCultureNote(sym, lang, region, rng){
  const list = cultureNotes[sym] || [];
  const filtered = list.filter(n => !n.allow || n.allow.includes(region || 'GLOBAL'));
  if (!filtered.length) return '';
  const i = Math.floor(rng()*filtered.length);
  const n = filtered[i];
  return n[lang] || '';
}
function rngFromSeed(seed){
  let t = seed;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  }
}

app.post('/v1/readings/generate', async (req,res) => {
  try {
    const { user_id, symbols: symIn, culture_mode=false, lang='tr', region='GLOBAL' } = req.body || {};
    if (!user_id || !Array.isArray(symIn) || !symIn.length) {
      return res.status(400).json({ error: 'missing user_id or symbols' });
    }
    const now = Date.now();
    const sorted = [...symIn].sort();
    const perm = sorted.join('>');

    let symbolsForRender = [...symIn];
    if (isRecentExactCombo(user_id, perm, now)){
      symbolsForRender.reverse();
    }

    const seed = makeSeed(user_id);
    for (let attempt=0; attempt<Config.MAX_ATTEMPTS; attempt++){
      const rng = rngFromSeed(seed+attempt);
      const lines = [];
      for (const s of symbolsForRender){
        const entry = bySymbol[s];
        if (!entry){ lines.push(`• ${s} — bir işaret belirdi.`); continue; }
        let line = entry.translations[lang] || entry.translations.tr;
        if (culture_mode){
          const note = pickCultureNote(s, lang, region, rng);
          if (note) line += ` (${note})`;
        }
        lines.push(`• ${line}`);
        const tplId = `${s}_v1_${lang}`;
        if (tplCooldownOK(user_id, tplId, now)) markTpl(user_id, tplId, now);
      }
      const closing = { tr:"Özetle: Haberler yeni kapılar açıyor; sezgin yolunu aydınlatıyor.", en:"In short: news opens doors; your intuition lights the way.", id:"Singkatnya: kabar membuka pintu; intuisi Anda menerangi langkah." }[lang] || "In short...";
      const text = `Fincandan görülenler\n${lines.join('\n')}\n${closing}`;
      const hash = simhash64(text);
      if (!tooSimilar(user_id, hash)){
        saveReading(user_id, { createdAt: now, textHash: hash, symbolPerm: perm });
        return res.json({ text });
      }
      symbolsForRender = symbolsForRender.reverse();
    }
    const fb = { tr:"Fincanda net figür az; yine de iç sesinle ilerle.", en:"Few clear figures; follow your inner voice.", id:"Figur jelas sedikit; ikuti suara hati." }[lang] || "Fallback.";
    const hash = simhash64(fb);
    saveReading(user_id, { createdAt: now, textHash: hash, symbolPerm: perm });
    return res.json({ text: fb });
  } catch(e){ console.error(e); return res.status(500).json({ error:'internal_error' }); }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, ()=>console.log(`[fal-engine-flat] listening on :${port}`));
