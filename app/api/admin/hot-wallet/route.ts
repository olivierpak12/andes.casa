import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const TronWeb = require('tronweb');

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin role in Convex
    const user: any = await convex.query(api.user.getUserByContact, { contact: session.user.contact });
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });

    // Build TronWeb and derive hot address
    const TRONGRID = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
    let tronWeb: any;
    try {
      tronWeb = new TronWeb({ fullHost: TRONGRID, headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
    } catch (e) {
      console.error('TronWeb init error:', e);
      return NextResponse.json({ hotAddress: null, trx: 0, usdt: 0 });
    }

    const privateKey = process.env.TRON_PRIVATE_KEY || null;
    let hotAddress = null;
    if (privateKey) {
      try { hotAddress = tronWeb.address.fromPrivateKey(privateKey); } catch (e) { hotAddress = null; }
    }

    // Fetch balances if we have an address
    let trx = 0, usdt = 0;
    if (hotAddress) {
      try { const raw = await tronWeb.trx.getBalance(hotAddress); trx = tronWeb.fromSun(raw); } catch (e) {}
      try {
        const contractAddr = process.env.ACTIVE_USDT_CONTRACT;
        if (contractAddr) {
          const contract = await tronWeb.contract().at(contractAddr);
          const b = await contract.balanceOf(hotAddress).call();
          usdt = parseInt(b.toString()) / 1e6;
        }
      } catch (e) {}
    }

    return NextResponse.json({ hotAddress, trx, usdt });
  } catch (err) {
    console.error('Admin hot-wallet GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin
    const user: any = await convex.query(api.user.getUserByContact, { contact: session.user.contact });
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { privateKey } = body || {};
    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 });

    // WARNING: This updates the runtime env only (ephemeral). Persisting secrets to disk is intentionally not implemented.
    process.env.TRON_PRIVATE_KEY = String(privateKey);

    return NextResponse.json({ success: true, message: 'Hot private key updated in runtime (ephemeral)' });
  } catch (err) {
    console.error('Admin hot-wallet POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
