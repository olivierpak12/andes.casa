#!/usr/bin/env node
// Usage: node scripts/check-tron-balances.js --address <recipient>

async function main(){
  const raw = process.argv.slice(2);
  const args = {};
  for (let i=0;i<raw.length;i++){
    const t=raw[i];
    if(t.startsWith('--')){
      const k=t.slice(2);
      const n=raw[i+1];
      if(n && !n.startsWith('--')){ args[k]=n; i++; } else args[k]=true;
    }
  }

  if(!args.address){ console.error('Usage: node scripts/check-tron-balances.js --address <address>'); process.exit(1); }

  try{ require('dotenv').config({ path: '.env.local' }); }catch(e){
    try{ const fs=require('fs'); if(fs.existsSync('.env.local')){ const env=fs.readFileSync('.env.local','utf8'); env.split(/\r?\n/).forEach(line=>{ const t=line.trim(); if(!t||t.startsWith('#')) return; const eq=t.indexOf('='); if(eq===-1) return; const k=t.slice(0,eq).trim(); let v=t.slice(eq+1).trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(!process.env[k]) process.env[k]=v; }); } }catch(e2){}
  }

  const TronWeb = require('tronweb');
  const TRONGRID = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
  const tronWeb = new TronWeb({ fullHost: TRONGRID, headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
  const privateKey = process.env.TRON_PRIVATE_KEY;
  if(!privateKey){ console.error('No TRON_PRIVATE_KEY'); process.exit(2); }
  const hot = tronWeb.address.fromPrivateKey(privateKey);
  console.log('Hot address:', hot);
  try{
    // fetch TRX balance
    let trxHot, trxRec;
    try { trxHot = await tronWeb.trx.getBalance(hot); } catch(e) { console.error('Error getting TRX hot balance:', require('util').inspect(e)); throw e; }
    try { trxRec = await tronWeb.trx.getBalance(args.address); } catch(e) { console.error('Error getting TRX recipient balance:', require('util').inspect(e)); throw e; }

    // fetch USDT (TRC20) balances via contract
    const activeContract = process.env.ACTIVE_USDT_CONTRACT;
    let usdtHot = 0, usdtRec = 0;
    if (activeContract) {
      let contract;
      try { contract = await tronWeb.contract().at(activeContract); } catch(e) { console.error('Error getting contract instance:', require('util').inspect(e)); throw e; }
      try { const b = await contract.balanceOf(hot).call(); usdtHot = parseInt(b.toString())/1e6; } catch(e){ console.error('Error calling balanceOf hot:', require('util').inspect(e)); }
      try { const b2 = await contract.balanceOf(args.address).call(); usdtRec = parseInt(b2.toString())/1e6; } catch(e){ console.error('Error calling balanceOf recipient:', require('util').inspect(e)); }
    }

    console.log('Hot balances: TRX', tronWeb.fromSun(trxHot), 'USDT', usdtHot);
    console.log('Recipient balances: TRX', tronWeb.fromSun(trxRec), 'USDT', usdtRec);
  } catch(e){ console.error('Error fetching balances (inspect):', require('util').inspect(e, { depth: 4 })); process.exit(3); }
}

main();
