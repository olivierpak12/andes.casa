#!/usr/bin/env node
// Derive hot wallet address from TRON_PRIVATE_KEY in .env.local
(async ()=>{
  try{ const fs=require('fs'); if(fs.existsSync('.env.local')){ const envRaw=fs.readFileSync('.env.local','utf8'); envRaw.split(/\r?\n/).forEach(line=>{ const t=line.trim(); if(!t||t.startsWith('#')) return; const i=t.indexOf('='); if(i===-1) return; const k=t.slice(0,i).trim(); let v=t.slice(i+1).trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(!process.env[k]) process.env[k]=v; }); }}catch(e){}
  try{
    const TronWeb=require('tronweb');
    const tron = new TronWeb({ fullHost: process.env.TRONGRID_API_URL || 'https://nile.trongrid.io', headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
    const pk = process.env.TRON_PRIVATE_KEY;
    if(!pk){ console.error('TRON_PRIVATE_KEY not set'); process.exit(2); }
    const hot = tron.address.fromPrivateKey(pk);
    console.log('HOT_ADDRESS:', hot);
  }catch(e){ console.error('Error deriving hot address:', e && e.message ? e.message : e); process.exit(3); }
})();
