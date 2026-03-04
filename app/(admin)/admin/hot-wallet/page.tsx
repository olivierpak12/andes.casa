"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HotWalletAdminPage() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pk, setPk] = useState('');
  const [msg, setMsg] = useState('');
  const [apiError, setApiError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function fetchInfo() {
    setLoading(true);
    setApiError('');
    try {
      // Fetch from audit-funds API which works correctly
      const res = await fetch('/api/admin/audit-funds');
      const data = await res.json();
      
      if (!res.ok) {
        setApiError(`API Error: ${data.error || 'Unknown error'}`);
        setInfo(null);
      } else {
        setInfo({
          hotAddress: data.hotWallet.address,
          trx: data.hotWallet.trx,
          usdt: data.hotWallet.usdt,
          userDeposits: data.userAccounts.totalDeposits || 0,
          userEarnings: data.userAccounts.totalEarnings || 0,
          userTransferred: data.userAccounts.totalTransferredOut || 0,
          userBalance: data.userAccounts.totalBalances || 0,
          userLocked: data.userAccounts.totalLocked || 0,
          userTotalFunds: data.userAccounts.totalFunds || 0,
          totalAccounted: data.summary.totalAccounted,
        });
        setLastRefresh(new Date());
        setApiError('');
      }
    } catch (e: any) {
      setApiError(`Failed to load: ${e.message}`);
    } finally { 
      setLoading(false); 
    }
  }

  useEffect(() => { 
    fetchInfo(); 
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  async function updateKey(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/admin/hot-wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ privateKey: pk }) });
      const j = await res.json();
      if (j.success) { setMsg('✓ Updated private key (runtime)'); setPk(''); fetchInfo(); }
      else setMsg(`✗ ${j.error || j.message || 'Failed'}`);
    } catch (e: any) { setMsg(`✗ Request failed: ${e.message}`); }
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-8 pt-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Hot Wallet</h1>
          <p className="text-gray-400">Platform funds management</p>
        </div>

        {/* Quick Links */}
        <div className="mb-6 flex gap-3">
          <Link href="/admin/audit-funds" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors">
            📊 Full Fund Audit
          </Link>
          <button 
            onClick={fetchInfo}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            🔄 Refresh Now
          </button>
        </div>

        {/* Error */}
        {apiError && <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">{apiError}</div>}

        {/* Loading */}
        {loading && <div className="text-center py-8"><div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div><p className="text-gray-400 mt-4">Loading...</p></div>}

        {/* Hot Wallet Info */}
        {info && !loading && (
          <>
            {/* Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Hot Wallet */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-cyan-400 mb-4">🔐 Hot Wallet Balance</h3>
                <div className="space-y-3">
                  <div><p className="text-gray-400 text-xs">Address</p><p className="font-mono text-sm text-cyan-300 break-all">{info.hotAddress}</p></div>
                  <div><p className="text-gray-400">TRX</p><p className="text-white font-bold text-xl">{info.trx ? info.trx.toFixed(4) : '—'} TRX</p></div>
                  <div className="pt-3 border-t border-slate-700"><p className="text-gray-400">USDT (On-Chain)</p><p className="text-cyan-400 font-bold text-2xl">${info.usdt ? info.usdt.toFixed(2) : '0.00'} USDT</p></div>
                </div>
              </div>

              {/* User Deposits */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-blue-400 mb-4">💰 User Deposits</h3>
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">Principal deposited by users</p>
                  <p className="text-blue-400 font-bold text-2xl">${info.userDeposits ? info.userDeposits.toFixed(2) : '0.00'} USDT</p>
                </div>
              </div>

              {/* User Earnings */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-green-400 mb-4">🎁 User Earnings</h3>
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">Rewards earned by users</p>
                  <p className="text-green-400 font-bold text-2xl">${info.userEarnings ? info.userEarnings.toFixed(2) : '0.00'} USDT</p>
                </div>
              </div>

              {/* Transferred Out */}
              {info.userTransferred > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 border border-red-700/30">
                  <h3 className="text-lg font-bold text-red-400 mb-4">📤 Transferred Out</h3>
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm">From external transfers (user sees balance unchanged)</p>
                    <p className="text-red-400 font-bold text-2xl">${info.userTransferred.toFixed(2)} USDT</p>
                  </div>
                </div>
              )}

              {/* Locked Principal */}
              {info.userLocked > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-yellow-400 mb-4">🔒 Locked in Tasks</h3>
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm">User funds invested in active tasks</p>
                    <p className="text-yellow-400 font-bold text-2xl">${info.userLocked.toFixed(2)} USDT</p>
                  </div>
                </div>
              )}

              {/* Total Accounted */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 md:col-span-2">
                <h3 className="text-lg font-bold text-purple-400 mb-4">📊 Total Accounted</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-gray-400">Hot Wallet:</p>
                    <p className="text-cyan-300 font-semibold">${info.usdt ? info.usdt.toFixed(2) : '0.00'} USDT</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-gray-400">User Deposits:</p>
                    <p className="text-blue-300 font-semibold">${info.userDeposits ? info.userDeposits.toFixed(2) : '0.00'} USDT</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-gray-400">User Earnings:</p>
                    <p className="text-green-300 font-semibold">${info.userEarnings ? info.userEarnings.toFixed(2) : '0.00'} USDT</p>
                  </div>
                  {info.userTransferred > 0 && (
                    <div className="flex justify-between">
                      <p className="text-gray-400">Transferred Out:</p>
                      <p className="text-red-300 font-semibold">${info.userTransferred.toFixed(2)} USDT</p>
                    </div>
                  )}
                  {info.userLocked > 0 && (
                    <div className="flex justify-between">
                      <p className="text-gray-400">Locked in Tasks:</p>
                      <p className="text-yellow-300 font-semibold">${info.userLocked.toFixed(2)} USDT</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-700 flex justify-between">
                    <p className="text-white font-bold">TOTAL:</p>
                    <p className="text-purple-300 font-bold text-lg">${info.totalAccounted ? info.totalAccounted.toFixed(2) : '0.00'} USDT</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Box */}
            {info.usdt && info.usdt > 0 ? (
              <div className="mb-8 p-6 bg-green-500/10 border-2 border-green-500 rounded-lg">
                <p className="text-green-300 font-bold mb-2">✅ Hot Wallet Funded</p>
                <p className="text-green-200">Your hot wallet is ready! It holds ${info.usdt.toFixed(2)} USDT in actual funds on the TRON blockchain.</p>
              </div>
            ) : (
              <div className="mb-8 p-6 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg">
                <p className="text-yellow-300 font-bold mb-2">⚠️ Hot Wallet Not Funded</p>
                <p className="text-yellow-200 mb-4">The hot wallet needs funds to process user withdrawals.</p>
                <Link href="/admin/audit-funds" className="text-yellow-400 hover:text-yellow-300 underline">View funding instructions →</Link>
              </div>
            )}

            {/* Last Refresh */}
            {lastRefresh && <p className="text-xs text-gray-500 text-center">Last updated: {lastRefresh.toLocaleTimeString()}</p>}
          </>
        )}
      </div>
    </main>
  );
}
