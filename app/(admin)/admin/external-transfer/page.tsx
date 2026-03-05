'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Transfer {
  _id: string;
  adminId: string;
  recipientAddress: string;
  amount: number;
  network: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionHash?: string;
  reason?: string;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
  updatedAt: number;
}

export default function ExternalTransferPage() {
  const [userId, setUserId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');
  const [refreshTime, setRefreshTime] = useState<Date | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ transferId: string; userId?: string } | null>(null);
  const [confirmUserId, setConfirmUserId] = useState('');
  const [confirmUser, setConfirmUser] = useState('');

  // Fetch transfers
  const fetchTransfers = async () => {
    try {
      console.log('[FETCH] Starting fetch from /api/admin/external-transfer');
      
      // First, check if API is healthy
      try {
        const healthRes = await fetch('/api/admin/external-transfer/health');
        console.log('[FETCH] Health check:', healthRes.ok ? '✓ Healthy' : '✗ Unhealthy');
        if (!healthRes.ok) {
          console.warn('[FETCH] API health check failed, continuing anyway...');
        }
      } catch (healthError) {
        console.warn('[FETCH] Could not reach health endpoint:', (healthError as any).message);
      }
      
      const res = await fetch('/api/admin/external-transfer');
      
      console.log('[FETCH] Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[FETCH] Error response:', errorData);
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('[FETCH] Successfully fetched transfers:', data.transfers?.length || 0);
      setTransfers(data.transfers || []);
      setRefreshTime(new Date());
    } catch (error: any) {
      console.error('[FETCH] Failed to fetch transfers:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200),
      });
      setMessage(`Error loading transfers: ${error.message}`);
      setMessageType('error');
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle transfer submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !recipient || !amount) {
      setMessageType('error');
      setMessage('Please fill in all required fields (User ID, Recipient Address, Amount)');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) {
      setMessageType('error');
      setMessage('Amount must be greater than 0');
      return;
    }

    // Ensure amount is positive (safeguard against negative input like "-10")
    const positiveAmount = Math.abs(parsedAmount);

    setLoading(true);
    try {
      const res = await fetch('/api/admin/external-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          recipientAddress: recipient,
          amount: positiveAmount,
          reason: reason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType('error');
        setMessage(data.error || 'Transfer failed');
      } else {
        setMessageType('success');
        setMessage(`Transfer initiated! User's deposit deducted, amount sent to external address.`);
        setUserId('');
        setRecipient('');
        setAmount('');
        setReason('');
        setTimeout(fetchTransfers, 2000);
      }
    } catch (error: any) {
      setMessageType('error');
      setMessage(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Retry a failed transfer
  const handleRetry = async (transferId: string) => {
    setRetryingId(transferId);
    try {
      const res = await fetch('/api/admin/external-transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType('error');
        setMessage(data.error || 'Retry failed');
      } else {
        setMessageType('success');
        setMessage('Transfer retry initiated!');
        setTimeout(fetchTransfers, 2000);
      }
    } catch (error: any) {
      setMessageType('error');
      setMessage(error.message || 'Network error');
    } finally {
      setRetryingId(null);
    }
  };

  // Confirm transfer received and credit user account
  const handleConfirmReceipt = async (transfer: Transfer) => {
    if (!confirmUserId.trim()) {
      setMessageType('error');
      setMessage('Please enter user ID to credit');
      return;
    }

    // Validate amount is positive
    if (transfer.amount <= 0) {
      setMessageType('error');
      setMessage(`Error: Transfer amount must be positive (got ${transfer.amount})`);
      return;
    }

    setConfirmingId(transfer._id);
    try {
      console.log('[CONFIRM] Crediting user:', {
        userId: confirmUserId,
        amount: transfer.amount,
        transferId: transfer._id,
      });

      const res = await fetch('/api/admin/confirm-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: confirmUserId,
          amount: transfer.amount, // Ensure this is the positive amount from transfer
          transactionHash: transfer.transactionHash || 'manual-confirmation',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType('error');
        setMessage(data.error || 'Confirmation failed');
      } else {
        setMessageType('success');
        setMessage(`✅ Credited ${transfer.amount} USDT to user!`);
        setConfirmModal(null);
        setConfirmUserId('');
        setTimeout(fetchTransfers, 1500);
      }
    } catch (error: any) {
      setMessageType('error');
      setMessage(error.message || 'Network error');
    } finally {
      setConfirmingId(null);
    }
  };

  // Filter transfers
  const filteredTransfers = filter === 'all' 
    ? transfers 
    : transfers.filter(t => t.status === filter);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500';
      case 'processing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-8 pt-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔄 External Transfers</h1>
          <p className="text-gray-400">Transfer funds from hot wallet to external addresses</p>
        </div>

        {/* Error Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            messageType === 'error' 
              ? 'bg-red-500/20 border-red-500 text-red-300' 
              : 'bg-green-500/20 border-green-500 text-green-300'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{messageType === 'error' ? '❌' : '✅'}</span>
              <div>
                <p className="font-semibold">{messageType === 'error' ? 'Error' : 'Success'}</p>
                <p className="text-sm mt-1">{message}</p>
                {messageType === 'error' && (
                  <p className="text-xs mt-2 opacity-75">
                    💡 Open browser console (F12) to see detailed logs. Click "Debug Info" button for troubleshooting.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mb-6 flex gap-3 flex-wrap">
          <Link href="/admin/hot-wallet" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors">
            🔐 Hot Wallet
          </Link>
          <button 
            onClick={fetchTransfers}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => {
              fetch('/api/admin/debug-transfer')
                .then(r => r.json())
                .then(d => console.log('Debug Info:', d.debug))
                .catch(e => console.error('Debug fetch failed:', e));
              setMessage('Debug info logged to console (F12)');
              setMessageType('success');
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            🐛 Debug Info
          </button>
        </div>

        {/* Info Box */}
        <div className="mb-6 space-y-3">
          <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
            <p className="text-green-300 text-sm mb-2">
              <strong>✅ How External Transfer Works</strong>
            </p>
            <ul className="text-green-300 text-xs space-y-1">
              <li>• Select the user whose deposit to deduct from</li>
              <li>• Enter recipient TRON address</li>
              <li>• Enter transfer amount (USDT)</li>
              <li>• Amount is deducted from user's deposit</li>
              <li>• User's visible balance remains unchanged</li>
              <li>• Amount is sent to external address via hot wallet</li>
            </ul>
          </div>

          <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4">
            <p className="text-blue-300 text-sm mb-2">
              <strong>ℹ️ Valid TRON Recipient Addresses</strong>
            </p>
            <ul className="text-blue-300 text-xs space-y-1">
              <li>• Must start with <code className="bg-slate-800 px-2 py-1 rounded text-cyan-300">T</code></li>
              <li>• Must be 34 characters long</li>
              <li>• Example: <code className="bg-slate-800 px-2 py-1 rounded text-cyan-300">TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT</code></li>
            </ul>
          </div>

          <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4">
            <p className="text-orange-300 text-sm mb-2">
              <strong>⚠️ Hot Wallet Requirements</strong>
            </p>
            <ul className="text-orange-300 text-xs space-y-1">
              <li>• Need <strong>at least 1 TRX</strong> for gas fees (in addition to USDT)</li>
              <li>• USDT: amount you want to send</li>
              <li>• TRX is automatically consumed as transaction fee</li>
            </ul>
          </div>

          <div className="bg-purple-500/10 border border-purple-500 rounded-lg p-4">
            <p className="text-purple-300 text-sm mb-2">
              <strong>🐛 Troubleshooting</strong>
            </p>
            <p className="text-purple-300 text-xs mb-2">
              Click the <strong>Debug Info</strong> button to verify:
            </p>
            <ul className="text-purple-300 text-xs space-y-1">
              <li>✓ Hot wallet address is valid</li>
              <li>✓ USDT balance is sufficient</li>
              <li>✓ TRX balance is at least 1</li>
              <li>✓ Smart contract can be reached</li>
            </ul>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transfer Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 sticky top-24">
              <h2 className="text-xl font-bold text-cyan-400 mb-4">✉️ Initiate Transfer</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* User ID */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">User ID (whose deposit to deduct) *</label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="User ID or contact"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">The user whose deposit will be deducted for this transfer</p>
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Recipient Address *</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="T... (TRON address)"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Amount (USDT) *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this transfer being made?"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                    rows={3}
                    disabled={loading}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '⏳ Processing...' : '💸 Send Transfer'}
                </button>

                {/* Message */}
                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    messageType === 'success'
                      ? 'bg-green-500/20 border border-green-500 text-green-300'
                      : 'bg-red-500/20 border border-red-500 text-red-300'
                  }`}>
                    {message}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Transfer History */}
          <div className="lg:col-span-2">
            {/* Filter Tabs */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors ${
                    filter === status
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({filteredTransfers.length})
                </button>
              ))}
            </div>

            {/* Transfers List */}
            <div className="space-y-3">
              {filteredTransfers.length === 0 ? (
                <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
                  <p className="text-gray-400">No transfers found</p>
                </div>
              ) : (
                filteredTransfers.map((transfer) => (
                  <div
                    key={transfer._id}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-white font-semibold">${transfer.amount.toFixed(2)} USDT</p>
                        <p className="text-gray-400 text-sm font-mono truncate">{transfer.recipientAddress}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStatusColor(transfer.status)}`}>
                        {transfer.status.toUpperCase()}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {transfer.reason && (
                        <p className="text-gray-400">
                          <span className="text-gray-500">Reason:</span> {transfer.reason}
                        </p>
                      )}
                      <p className="text-gray-500">
                        Created: {new Date(transfer.createdAt).toLocaleString()}
                      </p>

                      {transfer.transactionHash && (
                        <div className="pt-2 border-t border-slate-700">
                          <p className="text-cyan-400 text-xs font-mono break-all">
                            Hash: {transfer.transactionHash}
                          </p>
                        </div>
                      )}

                      {transfer.errorMessage && (
                        <div className="pt-2 border-t border-slate-700">
                          <div className="bg-red-500/10 rounded p-2 mb-3">
                            <p className="text-red-400 text-xs font-semibold mb-1">Error Details:</p>
                            <p className="text-red-300 text-xs">{transfer.errorMessage}</p>
                            {transfer.errorMessage.includes('issuer') && (
                              <p className="text-yellow-400 text-xs mt-2">💡 Tip: Check debug info or verify USDT contract address is correct</p>
                            )}
                            {transfer.errorMessage.includes('insufficient') && (
                              <p className="text-yellow-400 text-xs mt-2">💡 Tip: Hot wallet has insufficient USDT balance. Deposit more USDT.</p>
                            )}
                            {transfer.errorMessage.includes('address') && (
                              <p className="text-yellow-400 text-xs mt-2">💡 Tip: Verify recipient address starts with 'T' and is correct</p>
                            )}
                          </div>
                          {transfer.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(transfer._id)}
                              disabled={retryingId === transfer._id || loading}
                              className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {retryingId === transfer._id ? '⏳ Retrying...' : '🔄 Retry Transfer'}
                            </button>
                          )}
                        </div>
                      )}

                      {transfer.status === 'completed' && transfer.transactionHash && (
                        <div className="pt-2 border-t border-slate-700">
                          <div className="bg-green-500/10 rounded p-2 mb-3">
                            <p className="text-green-400 text-xs font-semibold mb-1">✅ Transaction Complete</p>
                            <p className="text-green-300 text-xs mb-2">USDT transferred to recipient address</p>
                            <p className="text-green-300 text-xs font-mono break-all">
                              Hash: {transfer.transactionHash.substring(0, 40)}...
                            </p>
                          </div>
                          <button
                            onClick={() => setConfirmModal({ transferId: transfer._id })}
                            disabled={confirmingId === transfer._id || loading}
                            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {confirmingId === transfer._id ? '⏳ Confirming...' : '💰 Credit User Account'}
                          </button>
                          <p className="text-gray-400 text-xs mt-2 text-center">
                            Click to confirm user received USDT and credit their account
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Last Update */}
            {refreshTime && (
              <p className="text-xs text-gray-500 text-center mt-4">
                Last updated: {refreshTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Receipt Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">💰 Credit User Account</h3>
            
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Enter the user ID to credit with the received USDT amount
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">User ID *</label>
                <input
                  type="text"
                  value={confirmUserId}
                  onChange={(e) => setConfirmUserId(e.target.value)}
                  placeholder="User ID (e.g., contact@example.com)"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  disabled={confirmingId !== null}
                  autoFocus
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-3">
                <p className="text-blue-300 text-xs">
                  <strong>Transfer Details:</strong><br />
                  Amount: <span className="text-white font-semibold">${transfers.find(t => t._id === confirmModal.transferId)?.amount.toFixed(2)} USDT</span><br />
                  Status: <span className="text-green-400 font-semibold">Completed on-chain</span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setConfirmModal(null);
                    setConfirmUserId('');
                  }}
                  disabled={confirmingId !== null}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const transfer = transfers.find(t => t._id === confirmModal.transferId);
                    if (transfer) handleConfirmReceipt(transfer);
                  }}
                  disabled={confirmingId !== null || !confirmUserId.trim()}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirmingId ? '⏳ Confirming...' : '✅ Confirm & Credit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
