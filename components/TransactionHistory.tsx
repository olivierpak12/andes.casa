'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface TransactionHistoryProps {
  limit?: number;
}

export default function TransactionHistory({ limit = 10 }: TransactionHistoryProps) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      // In a real app, you'd need to fetch the user ID from Convex based on email
      // For now, we'll skip this since the user ID mapping is complex
      // This will be handled by the API
    }
  }, [session]);

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view your transaction history.</p>
      </div>
    );
  }

  // Temporarily show placeholder since we need to set up user ID mapping from NextAuth to Convex
  return (
    <div className="w-full bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Transaction History</h2>
      <div className="text-center py-12">
        <p className="text-gray-600">Transaction history feature will be available soon.</p>
      </div>
    </div>
  );

  /*
  if (!transactions) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading transactions...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No transactions yet.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'deposit'
      ? 'text-green-600'
      : 'text-red-600';
  };

  const getTypeIcon = (type: string) => {
    return type === 'deposit' ? '📥' : '📤';
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Transaction History</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Type
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Amount
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Network
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Status
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr
                key={transaction._id}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4">
                  <span className={`text-lg ${getTypeColor(transaction.type)}`}>
                    {getTypeIcon(transaction.type)} {transaction.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 px-4 font-semibold text-gray-900">
                  {transaction.amount.toFixed(2)} USDT
                </td>
                <td className="py-4 px-4 text-gray-700">
                  {transaction.network.toUpperCase()}
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                      transaction.status
                    )}`}
                  >
                    {transaction.status.charAt(0).toUpperCase() +
                      transaction.status.slice(1)}
                  </span>
                </td>
                <td className="py-4 px-4 text-gray-700">
                  {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                  {new Date(transaction.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong>Total Transactions:</strong> {transactions.length}
          </p>
        </div>
      )}
    </div>
  );
  */
}
