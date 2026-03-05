'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuditFundsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [refreshTime, setRefreshTime] = useState(new Date());

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/audit-funds');
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch audit data');
        return;
      }

      const result = await response.json();
      setData(result);
      setRefreshTime(new Date());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Error fetching audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
    const interval = setInterval(fetchAudit, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-300">Loading audit data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8 pt-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/hot-wallet" className="text-cyan-400 hover:text-cyan-300 mb-4 inline-block">
            ← Back to Hot Wallet
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Platform Fund Audit</h1>
          <p className="text-gray-400">Real-time verification of platform funds</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            ❌ {error}
          </div>
        )}

        {data && (
          <>
            {/* Overall Status */}
            <div className={`mb-8 p-6 rounded-lg border-2 ${
              data.summary.status === 'OK' 
                ? 'bg-green-500/10 border-green-500' 
                : 'bg-yellow-500/10 border-yellow-500'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {data.summary.status === 'OK' ? '✅ Funds Verified' : '⚠️ Funding Required'}
                  </h2>
                  <p className={data.summary.status === 'OK' ? 'text-green-300' : 'text-yellow-300'}>
                    Last updated: {refreshTime.toLocaleTimeString()}
                  </p>
                  {data.summary.fundingRequired > 0 && (
                    <p className="text-yellow-300 font-semibold mt-2">
                      🚨 Hot wallet needs ${data.summary.fundingRequired.toFixed(2)} USDT to cover all user balances
                    </p>
                  )}
                </div>
                <button
                  onClick={fetchAudit}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Refresh Now
                </button>
              </div>
            </div>

            {/* Hot Wallet Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-cyan-400 mb-4">🔐 Hot Wallet</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400">Address:</span>
                    <span className="text-white font-mono text-sm break-all text-right max-w-xs">{data.hotWallet.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TRX Balance:</span>
                    <span className="text-white font-semibold">{data.hotWallet.trx} TRX</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">USDT Balance:</span>
                    <span className="text-cyan-400 font-semibold text-lg">${data.hotWallet.usdt} USDT</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-blue-400 mb-4">👥 User Accounts</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Users:</span>
                    <span className="text-white font-semibold">{data.userAccounts.totalUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Balances:</span>
                    <span className="text-blue-400 font-semibold text-lg">${data.userAccounts.totalBalances} USDT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
              <h3 className="text-lg font-bold text-green-400 mb-4">📊 Transaction History</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Total Deposits (Completed)</p>
                  <p className="text-green-400 font-semibold text-xl">${data.transactions.totalDeposits}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Withdrawals (Completed)</p>
                  <p className="text-red-400 font-semibold text-xl">${data.transactions.totalWithdrawals}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Pending Withdrawals</p>
                  <p className="text-yellow-400 font-semibold text-xl">${data.transactions.pendingWithdrawals}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Transactions</p>
                  <p className="text-blue-400 font-semibold text-xl">{data.transactions.totalCompleted}</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
              <h3 className="text-lg font-bold text-purple-400 mb-6">💰 Financial Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                  <span className="text-gray-400">Net Flows (Deposits - Withdrawals):</span>
                  <span className="text-white font-semibold text-lg">${data.summary.netFlows}</span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                  <span className="text-gray-400">Hot Wallet (On-Chain):</span>
                  <span className="text-cyan-400 font-semibold text-lg">${data.summary.hotWalletBalance}</span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                  <span className="text-gray-400">User Balances (Database):</span>
                  <span className="text-blue-400 font-semibold text-lg">${data.summary.userBalances}</span>
                </div>

                <div className="flex justify-between items-center pt-2 bg-slate-700/50 p-4 rounded">
                  <span className="text-gray-300 font-semibold">Total Accounted:</span>
                  <span className="text-green-400 font-bold text-xl">${data.summary.totalAccounted}</span>
                </div>

                {data.summary.discrepancy > 0.1 && (
                  <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500 rounded">
                    <p className="text-yellow-300 font-semibold">
                      ⚠️ Discrepancy: ${data.summary.discrepancy}
                    </p>
                  </div>
                )}

                {/* WHERE IS THE MONEY */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <p className="text-gray-400 mb-3">📍 WHERE IS THE MONEY:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-bold">1.</span>
                      <div>
                        <p className="font-semibold text-white">${data.summary.hotWalletBalance} USDT</p>
                        <p className="text-gray-400">In hot wallet (on-chain TRON blockchain)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-blue-400 font-bold">2.</span>
                      <div>
                        <p className="font-semibold text-white">${data.summary.userBalances} USDT</p>
                        <p className="text-gray-400">In user accounts (Convex database)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Where Are the Funds */}
            <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500 rounded-lg">
              <h3 className="text-lg font-bold text-blue-400 mb-4">🏦 Where Are The Funds?</h3>
              <ul className="space-y-2 text-gray-300">
                <li>✓ <strong>${data.summary.hotWalletBalance} USDT</strong> on-chain in your hot wallet</li>
                <li>✓ <strong>${data.summary.userBalances} USDT</strong> balance in user accounts (database)</li>
                <li>✓ <strong>Total ${data.summary.totalAccounted} USDT</strong> accounted for</li>
              </ul>
            </div>

            {/* Funding Instructions if needed */}
            {data.summary.fundingRequired > 0 && (
              <div className="mt-8 p-6 bg-red-500/20 border-2 border-red-500 rounded-lg">
                <h3 className="text-lg font-bold text-red-400 mb-4">🚨 Action Required: Fund Hot Wallet</h3>
                <p className="text-gray-300 mb-4">
                  Your hot wallet needs <strong className="text-red-300">${data.summary.fundingRequired.toFixed(2)} USDT</strong> to cover all user balances.
                </p>
                
                <div className="bg-slate-800 p-4 rounded mb-4">
                  <p className="text-sm text-gray-400 mb-2">Hot Wallet Address (copy this):</p>
                  <p className="font-mono text-cyan-400 break-all">{data.hotWallet.address}</p>
                </div>

                <ol className="space-y-3 text-gray-300">
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-400">1.</span>
                    <div>
                      <p>Go to Nile Testnet Faucet</p>
                      <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline text-sm">
                        https://nileex.io/join/getJoinPage
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-400">2.</span>
                    <p>Paste your hot wallet address above and request <strong>${Math.ceil(data.summary.fundingRequired)} USDT</strong></p>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-400">3.</span>
                    <p>Wait for the transaction to confirm (2-5 minutes)</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-400">4.</span>
                    <p>Click "Refresh Now" above to verify the balance updated</p>
                  </li>
                </ol>

                <p className="text-sm text-gray-400 mt-4">
                  💡 Once funded, the hot wallet will hold all platform USDT for user withdrawals.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
