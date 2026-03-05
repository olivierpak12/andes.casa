"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import toast from "@/lib/clientToast";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function WithdrawContent() {
  const { data: session } = useSession();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [txPassword, setTxPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showForgottenModal, setShowForgottenModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const network = "trc20";

  const MIN_WITHDRAWAL = {
    trc20: 5,
  };

  const user = useQuery(
    api.user.getUserByContact,
    session?.user?.contact ? { contact: session.user.contact } : "skip",
  );

  const withdrawals = useQuery(
    api.withdrawal.getUserWithdrawals,
    user?._id ? { userId: user._id } : "skip",
  );

  const canBypassPassword = useQuery(
    api.user.canBypassPasswordVerification,
    user?._id ? { userId: user._id } : "skip",
  );

  const timeRemainingQuery = useQuery(
    api.user.getPasswordBypassTimeRemaining,
    user?._id ? { userId: user._id } : "skip",
  );

  const isPasswordLocked = useQuery(
    api.user.isTransactionPasswordLocked,
    user?._id ? { userId: user._id } : "skip",
  );

  const passwordLockTimeRemaining = useQuery(
    api.user.getTransactionPasswordLockTimeRemaining,
    user?._id ? { userId: user._id } : "skip",
  );

  const markForgottenMutation = useMutation(api.user.markPasswordForgotten);

  // Update time remaining every second
  useEffect(() => {
    if (timeRemainingQuery !== null && timeRemainingQuery !== undefined) {
      setTimeRemaining(timeRemainingQuery);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null;
          const newTime = Math.max(0, prev - 1000);
          return newTime > 0 ? newTime : null;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (passwordLockTimeRemaining !== null && passwordLockTimeRemaining !== undefined) {
      // If password is locked, track the lock time remaining
      setTimeRemaining(passwordLockTimeRemaining);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null;
          const newTime = Math.max(0, prev - 1000);
          return newTime > 0 ? newTime : null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemainingQuery, passwordLockTimeRemaining]);

  const handleMarkForgotten = async () => {
    if (!user?._id) {
      toast.error("User not found");
      return;
    }

    try {
      await markForgottenMutation({ userId: user._id });
      toast.success("Password marked as forgotten. You can withdraw after 24 hours without entering a password.");
      setShowForgottenModal(false);
    } catch (error) {
      console.error("Failed to mark password as forgotten:", error);
      toast.error("Failed to mark password as forgotten. Please try again.");
    }
  };

  const formatTimeRemaining = (ms: number | null): string => {
    if (ms === null || ms === undefined || ms <= 0) return "Ready";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleWithdraw invoked', { amount, address, txPassword });

    // Validation 1: Check fields are filled
    if (!amount || !address || parseFloat(amount) <= 0) {
      console.log('VALIDATION FAILED: Missing fields', { amount, address, parsedAmount: parseFloat(amount) });
      toast.error("Please fill in all fields with valid amounts");
      return;
    }
    console.log('✓ Fields validation passed');

    // Validation 2: Check password (skip if 24hr bypass is available)
    if (!canBypassPassword && !isPasswordLocked && (!txPassword || txPassword.trim().length === 0)) {
      console.log('VALIDATION FAILED: Missing password');
      toast.error("Please enter your transaction password");
      return;
    }
    console.log('✓ Password validation passed (or 24hr bypass available)');

    // Validation 3: Check user exists
    if (!user){
      console.log('VALIDATION FAILED: No user object');
      toast.error("User not found or session expired");
      return;
    }
    console.log('✓ User exists', { userId: user._id, depositAmount: user.depositAmount, earnings: user.earnings });

    // Calculate withdrawable amount: only `earnings` are withdrawable (deposits are locked)
    const withdrawableAmount = Math.max(0, user.earnings || 0);
    console.log('Withdrawable amount check:', { requested: parseFloat(amount), available: withdrawableAmount });

    if (parseFloat(amount) > withdrawableAmount) {
      console.log('VALIDATION FAILED: Insufficient balance');
      toast.error(
        `Insufficient withdrawable balance. Available: ${withdrawableAmount.toFixed(2)} USDT`,{
            richColor: true,
        }
      );
      return;
    }
    console.log('✓ Balance validation passed');

    // Check minimum amount for selected network
    const minAmount = MIN_WITHDRAWAL[network as keyof typeof MIN_WITHDRAWAL];
    console.log('Minimum amount check:', { requested: parseFloat(amount), minimum: minAmount });
    if (parseFloat(amount) < minAmount) {
      console.log('VALIDATION FAILED: Below minimum');
      toast.error(
        `Minimum withdrawal for ${network.toUpperCase()} is ${minAmount} USDT`,
      );
      return;
    }
    console.log('✓ Minimum amount validation passed');

    setServerError(null);
    setLoading(true);
    console.log('Starting withdrawal request...');

    try {
      // Only TRC20 (Tron) withdrawals supported
      console.log('Sending POST request to /api/tron/withdraw');
      const response = await fetch("/api/tron/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          address,
          network,
          transactionPassword: txPassword,
        }),
      });

      console.log('Response received:', { status: response.status, statusText: response.statusText });
      const data = await response.json();
      console.log('Parsed response data:', data);

      if (!response.ok) {
        const details = data?.details ? `: ${data.details}` : "";
        console.log('Request failed:', { status: response.status, error: data?.error, details });
        
        // Handle password lock (24 hour security lock after password reset)
        if (
          response.status === 403 &&
          typeof data?.error === "string" &&
          data.error.toLowerCase().includes("locked")
        ) {
          const msg = data?.error || "Your password is locked for security. Please wait 24 hours after resetting your password.";
          console.log('Error: password locked');
          toast.error(msg);
          setServerError(msg);
          setLoading(false);
          return;
        }

        // Helpful UX for missing transaction-password configuration
        if (
          response.status === 400 &&
          typeof data?.error === "string" &&
          data.error.toLowerCase().includes("not configured")
        ) {
          const msg =
            "Transaction password not configured. Please set your transaction password in account settings or contact support.";
          console.log('Error: tx password not configured');
          toast.error(msg);
          setServerError(msg);
          setLoading(false);
          return;
        }

        // Graceful handling for invalid transaction password
        if (
          response.status === 401 &&
          typeof data?.error === "string" &&
          data.error.toLowerCase().includes("invalid transaction password")
        ) {
          const msg =
            "Invalid transaction password. Please check and try again.";
          console.log('Error: invalid tx password');
          toast.error(msg);
          // Clear the input to encourage re-entry
          setTxPassword("");
          setServerError(msg);
          setLoading(false);
          return;
        }

        // Show server-provided error message in the UI
        const msg = (data?.error || "Withdrawal failed") + details;
        console.log('Generic error response:', msg);
        setServerError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      console.log('✓ Request successful, processing response');
      toast.success("Withdrawal successful! Transaction ID: " + data.txId);

      setAmount("");
      setAddress("");
      setTxPassword("");
      setServerError(null);
      console.log('✓ Withdrawal completed and form reset');
      // No need to manually refresh, Convex subscriptions handle it
    } catch (error: any) {
      console.error("❌ Withdrawal error caught:", error);
      const msg = error?.message || "Failed to process withdrawal";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <main className="bg-gradient-to-br mt-14 from-green-300 via-cyan-200 to-white min-h-screen px-4 py-8 font-montserrat">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Withdraw Funds</h1>
          <p className="text-gray-600">
            Securely withdraw your earnings to your crypto wallet.
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Available Balance
              </p>
              <h2 className="text-4xl font-bold text-gray-800">
                $
                {((user.earnings || 0)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h2>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Withdrawable (profit): $
              {(user.earnings || 0 || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <div className="text-xs text-gray-500">
                Invested principal is locked and cannot be withdrawn.
              </div>
            </div>

            {/* Transaction Password Input moved to form below */}
            <div className="p-3 bg-cyan-50 rounded-xl">
              <span className="text-cyan-700 font-semibold capitalize">
                TRC20 Network
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Withdrawal Form */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-6">
              <h3 className="text-white font-bold text-xl">
                Request Withdrawal
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <form onSubmit={handleWithdraw} noValidate className="space-y-4">
                {/* Address Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter TRON (TRC20) address"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    required
                  />
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (USDT)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min={MIN_WITHDRAWAL.trc20}
                      step="0.01"
                      className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                      required
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-gray-500">
                    <span>Min: ${MIN_WITHDRAWAL.trc20}.00</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAmount(String(Math.max(0, user.earnings || 0)))
                      }
                      className="text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Transaction Password Input (moved here) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Password
                  </label>
                  {isPasswordLocked ? (
                    <div className="w-full px-4 py-4 rounded-lg bg-red-50 border border-red-300 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 012.05 8.006A6 6 0 0114.944 1.61a6.002 6.002 0 01-1.466 13.28zm-16.477-6.89a8 8 0 1114.144-7.997 8.002 8.002 0 01-14.144 8.997z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-700 font-bold text-sm">New Password - Withdrawal Locked</span>
                      </div>
                      <p className="text-red-600 text-xs">Your password was just reset. For security, withdrawals are locked for 24 hours.</p>
                    </div>
                  ) : canBypassPassword ? (
                    <div className="w-full px-4 py-3 rounded-lg bg-green-50 border border-green-300 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-700 font-medium text-sm">Password bypass available - proceed with withdrawal</span>
                    </div>
                  ) : (
                    <input
                      type="password"
                      value={txPassword}
                      onChange={(e) => setTxPassword(e.target.value)}
                      placeholder="Enter your transaction password"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                      required
                    />
                  )}
                  <div className="mt-3 space-y-2">
                    {isPasswordLocked && timeRemaining !== null && timeRemaining > 0 && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded font-semibold">
                        <span>Time remaining:</span> {formatTimeRemaining(timeRemaining)}
                      </div>
                    )}
                    {timeRemaining !== null && timeRemaining > 0 && !isPasswordLocked && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        <span className="font-semibold">24-hour bypass countdown:</span> {formatTimeRemaining(timeRemaining)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href="/forgot-transaction-password"
                        className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex-1"
                      >
                        Reset password via email
                      </Link>
                      {!timeRemaining && !isPasswordLocked && (
                        <button
                          type="button"
                          onClick={() => setShowForgottenModal(true)}
                          className="text-sm text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded border border-amber-300 hover:bg-amber-50 transition-colors"
                        >
                          Mark as forgotten
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !amount || !address || isPasswordLocked}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-white shadow-lg transform transition-all duration-200 
                                ${
                                  loading || !amount || !address || isPasswordLocked
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 hover:scale-[1.02] hover:shadow-xl"
                                }`}
                >
                  {isPasswordLocked ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Password Locked - Wait 24 Hours
                    </span>
                  ) : loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Withdraw Funds"
                  )}
                </button>
                {serverError && (
                  <div className="text-sm text-red-600 mt-2">{serverError}</div>
                )}
              </form>
            </div>
          </div>

          {/* History Section */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">
                Recent Withdrawals
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 p-0">
              {!withdrawals ? (
                <div className="p-6 text-center text-gray-500">
                  Loading history...
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center text-gray-500">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p>No withdrawal history yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {withdrawals.map((tx) => (
                    <div
                      key={tx._id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold
                                            ${
                                              tx.status === "completed"
                                                ? "bg-green-100 text-green-700"
                                                : tx.status === "pending"
                                                  ? "bg-yellow-100 text-yellow-700"
                                                  : "bg-red-100 text-red-700"
                                            }`}
                        >
                          {tx.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(tx.createdAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">
                            -${tx.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-[150px]">
                            {tx.walletAddress}
                          </p>
                        </div>
                        {tx.transactionHash && (
                          <a
                            href={`https://nile.tronscan.org/#/transaction/${tx.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-600 hover:text-cyan-700 text-xs flex items-center gap-1"
                          >
                            <span>View</span>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Forgotten Password Confirmation Modal */}
      {showForgottenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800">Mark Password as Forgotten?</h3>
              <p className="text-gray-600 text-sm mt-2">
                You will be able to withdraw after <span className="font-bold">24 hours</span> without entering your transaction password.
              </p>
              <p className="text-gray-500 text-xs mt-3">
                To access your funds sooner, reset your password via email.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleMarkForgotten}
                className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
              >
                Yes, mark as forgotten
              </button>
              <button
                onClick={() => setShowForgottenModal(false)}
                className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <Link
                href="/forgot-transaction-password"
                className="block w-full text-center py-2 px-4 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 font-semibold rounded-lg transition-colors text-sm"
              >
                Reset password via email
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
