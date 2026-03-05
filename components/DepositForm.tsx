"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import QRCode from 'qrcode';

const MIN_DEPOSIT = {
  trc20: 10,
};

export default function DepositForm() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [qrCode, setQrCode] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (session?.user?.contact) {
      fetchDepositAddress();
    }
  }, [session]);

  const fetchDepositAddress = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tron/deposit');
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch deposit address');
        return;
      }

      const data = await response.json();
      setDepositInfo(data);

      // Generate QR code
      const qrString = `https://tronscan.org/#/transfer/${data.depositAddress}`;
      const qr = await QRCode.toDataURL(qrString);
      setQrCode(qr);
    } catch (err: any) {
      setError(err.message || 'Error fetching deposit address');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async () => {
    if (depositInfo?.depositAddress) {
      try {
        await navigator.clipboard.writeText(depositInfo.depositAddress);
        alert('✓ Address copied to clipboard');
      } catch {
        alert('Failed to copy');
      }
    }
  };

  if (status === 'unauthenticated') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <p className="text-center text-gray-600">Please sign in to deposit</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading deposit address...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Deposit USDT</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {depositInfo && (
          <>
            {/* Deposit Address Section */}
            <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-cyan-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Deposit Address</h3>
              
              {/* QR Code */}
              {qrCode && (
                <div className="mb-6 text-center">
                  <img src={qrCode} alt="Deposit Address QR Code" className="w-40 h-40 mx-auto border-2 border-gray-300 p-2 rounded-lg" />
                  <p className="text-xs text-gray-500 mt-2">Scan to open in wallet</p>
                </div>
              )}

              {/* Address Display */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Send Your USDT (TRC20) To:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={depositInfo.depositAddress}
                    readOnly
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50"
                  />
                  <button
                    onClick={copyAddress}
                    className="px-4 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white p-4 rounded-lg mt-4 space-y-2 text-sm">
                {depositInfo.instructions && depositInfo.instructions.map((instruction: string, i: number) => (
                  <div key={i} className="flex gap-3 text-gray-700">
                    <span className="font-bold text-cyan-600">{i + 1}.</span>
                    <span>{instruction}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Balance */}
            <div className="mb-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Account Balance</h3>
              <p className="text-3xl font-bold text-green-600">
                ${(depositInfo.userBalance || 0).toFixed(2)} USDT
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Balances update after deposit confirmation
              </p>
            </div>

            {/* How It Works */}
            <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span>Send USDT to the platform address above</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span>Wait for blockchain confirmation (1-2 minutes)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span>Your account balance will update automatically</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">4.</span>
                  <span>You can then withdraw or use your balance</span>
                </li>
              </ul>
            </div>

            {/* Network Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Network</p>
                  <p className="font-semibold text-gray-900">TRON (Nile Testnet)</p>
                </div>
                <div>
                  <p className="text-gray-600">Minimum Deposit</p>
                  <p className="font-semibold text-gray-900">10 USDT</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
