#!/usr/bin/env node
// Check TRONGRID API connectivity and contract ABI
(async()=>{
  try{ require('dotenv').config({ path: '.env.local' }); }catch(e){
    try {
      const fs = require('fs');
      const envPath = '.env.local';
      if (fs.existsSync(envPath)) {
        const envRaw = fs.readFileSync(envPath, 'utf8');
        envRaw.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eq = trimmed.indexOf('=');
          if (eq === -1) return;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        });
      }
    } catch (e2) {}
  }
  const TRONGRID = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
  const key = process.env.TRONGRID_API_KEY || '';
  const active = process.env.ACTIVE_USDT_CONTRACT || '';
  console.log('TRONGRID:', TRONGRID);
  console.log('ACTIVE_USDT_CONTRACT:', active);
  try{
    const res = await fetch(TRONGRID, { headers: { 'TRON-PRO-API-KEY': key } });
    console.log('Base status:', res.status);
    const res2 = await fetch(`${TRONGRID}/v1/contracts/${active}/abi`, { headers: { 'TRON-PRO-API-KEY': key } });
    console.log('/v1/contracts/{contract}/abi status:', res2.status);
    const txt = await res2.text();
    console.log('ABI response snippet:', txt.slice(0,1000));
  } catch(e){ console.error('Fetch error:', require('util').inspect(e, { depth: 4 })); }
})();
