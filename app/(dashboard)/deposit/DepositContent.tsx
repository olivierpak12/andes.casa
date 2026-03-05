"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { DepositCard } from "./_components/DepositCard";
// network selector not needed now that only TRC20 is supported
import { DepositHeader } from "./_components/DepositHeader";
import { TeamSection } from "./_components/TeamSection";
import { useDepositAddress } from "@/lib/hooks/useDepositAddress";
import { useRouter } from "next/navigation";

// Define auth states as constants
const AUTH_STATE = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
} as const;

export default function DepositContent() {
  const { data: session, status } = useSession();

  // Deposit state (only TRC20)
  const selectedNetwork = "trc20";
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const router = useRouter();

  // Convex queries
  const user = useQuery(
    api.user.getUserByContact,
    session?.user?.contact ? { contact: session.user.contact } : "skip"
  );

  const teamReport = useQuery(
    api.team.getTeamReport,
    user?._id ? { userId: user._id } : "skip"
  );

  // Use the deposit address hook
  const { depositAddresses, generating, generateAddress } = useDepositAddress({
    userId: user?._id,
  });

  // Get current address for TRC20 network
  const currentAddress = depositAddresses?.trc20 || "";

  // ROBUST AUTH STATE LOGIC
  const authState = useMemo(() => {
    if (status === "loading") {
      return AUTH_STATE.LOADING;
    }

    if (status === "unauthenticated" || !session) {
      return AUTH_STATE.UNAUTHENTICATED;
    }

    if (user === undefined) {
      return AUTH_STATE.LOADING;
    }

    if (!user || !user._id) {
      return AUTH_STATE.UNAUTHENTICATED;
    }

    return AUTH_STATE.AUTHENTICATED;
  }, [status, session, user]);



  // Deposit information (Tron/TRC20 only) - memoized to keep reference stable
  const depositInfo = useMemo(
    () => ({
      id: "trc20",
      network: "Tron (TRC20)",
      token: "USDT / TRX",
      minDeposit: 10,
    }),
    []
  );


  // Balance state 
  const [walletBalance, setWalletBalance] = useState<{ trx: number; usdt: number } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Format address for display
  const shortAddress = useMemo(() => {
    if (!currentAddress) return "";
    const start = currentAddress.slice(0, 8);
    const end = currentAddress.slice(-8);
    return `${start}...${end}`;
  }, [currentAddress]);

  // Generate address when network changes and no address exists
  useEffect(() => {
    const userId = user && typeof user._id !== "undefined" ? user._id : null;

    if (
      authState === AUTH_STATE.AUTHENTICATED &&
      userId &&
      !currentAddress &&
      !generating
    ) {
      // Auto-generate address for the selected network
      generateAddress("trc20");
    }
    // Keep dependency array length stable by always providing the same
    // set of entries (use null for absent userId)
  }, [authState, user && user._id ? user._id : null, currentAddress, generating, generateAddress]);

  // Initial balance check on mount or address change
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const checkBalance = async () => {
      if (!currentAddress) return;
      
      try {
        setLoadingBalance(true);
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch("/api/tron/check-deposits", {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (mounted && data.balance) {
          setWalletBalance(data.balance);
        }
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("Failed to check balance:", message);
          
          // Only show error if it's not a normal abort
          if (message !== "The operation was aborted") {
            toast.error(`Balance check failed: ${message.substring(0, 100)}`);
          }
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
          setLoadingBalance(false);
        }
      }
    };

    if (currentAddress) {
      checkBalance();
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [currentAddress]);

  // QR Code generation effect
  useEffect(() => {
    let mounted = true;

    if (!currentAddress) {
      setQrSrc("");
      return;
    }

    QRCode.toDataURL(currentAddress, { errorCorrectionLevel: "H" })
      .then((url) => {
        if (mounted) setQrSrc(url);
      })
      .catch((error) => {
        console.error("QR generation failed:", error);
        if (mounted) setQrSrc("");
      });

    return () => {
      mounted = false;
    };
  }, [currentAddress]);

  // Copy address handler
  const handleCopy = async () => {
    if (!currentAddress) return;

    try {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };


  // Handle manual address generation (optional button)
  const handleGenerateAddress = async () => {
    await generateAddress('trc20');
  };

  const checkDeposits = async () => {
     try {
        const toastId = toast.loading("Scanning blockchain...");
        setLoadingBalance(true);
        
        const response = await fetch("/api/tron/check-deposits");
        const data = await response.json();
        
        // Update balance state
        if (data.balance) {
          setWalletBalance(data.balance);
        }
        
        if (data.totalNewDeposits > 0) {
          toast.success(`Success! Found ${data.totalNewDeposits} new deposit(s)`, { id: toastId });
        } else {
          toast("No new transactions found", { icon: "🔍", id: toastId });
        }
      } catch (error) {
        console.error("Check deposits failed:", error);
        toast.error("Failed to sync deposits");
      } finally {
        setLoadingBalance(false);
      }
  };

  const userName = user?.fullname || "User";

  // Loading State
  if (authState === AUTH_STATE.LOADING) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  // Unauthenticated State
  if (authState === AUTH_STATE.UNAUTHENTICATED) {
     return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
           <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Sign in Required</h2>
              <p className="text-gray-600">Please access your account to manage deposits.</p>
              <Link href="/sign-in" className="inline-block px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
                 Sign In
              </Link>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-cyan-100 selection:text-cyan-900">
      {/* Background Effects (Light Mode) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-100/60 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/60 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header Section */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500">
            Deposit Assets
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl">
            Securely fund your account using our multi-chain gateway. 
            All deposits are monitored 24/7 with enterprise-grade security.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDE: Account Summary & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
             {/* Account Summary Card */}
             <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-xl p-8 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/5 group">
                {/* Card Decoration */}
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-gradient-to-br from-cyan-100 to-indigo-100 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-all duration-500"></div>
                
                <div className="relative">
                  <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Total Balance</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                      ${user?.depositAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </span>
                    <span className="text-lg text-slate-500 font-medium">USDT</span>
                  </div>

                  {/* Trust Badge */}
                  <div className="mt-8 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full w-fit">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-semibold text-emerald-700">Secure Connection Active</span>
                  </div>
                </div>

                {/* Quick Actions (Future) */}
                <div className="mt-8 grid grid-cols-2 gap-3">
                   <button onClick={()=> router.push('/withdraw')}  className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all text-sm font-medium text-slate-600">
                      Withdraw
                   </button>
                   <button className="px-4 py-3 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700 cursor-default text-sm font-medium">
                      Deposit
                   </button>
                </div>
             </div>

             {/* Team Stats Placeholder (Optional) */}
             {/* <div className="rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-sm p-6">
                <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wide mb-4">Team Performance</h3>
                <div className="h-24 flex items-center justify-center text-slate-400 text-sm">
                   Stats coming soon...
                </div>
             </div> */}
          </div>

          {/* RIGHT SIDE: Main Deposit Interface */}
          <div className="lg:col-span-8">
            <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
               {/* Top Glow Line */}
               <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>


               <div className="p-6 md:p-8">
                   <DepositCard
                      loading={generating || loadingBalance}
                      checking={loadingBalance}
                      qrSrc={qrSrc}
                      shortAddress={shortAddress}
                      userAddress={currentAddress}
                      copied={copied}
                      onCopy={handleCopy}
                      depositInfo={depositInfo}
                      walletBalance={walletBalance}
                      onCheckDeposit={checkDeposits}
                      onGenerateAddress={handleGenerateAddress}
                    />
               </div>
            </div>
            
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-slate-500 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> 
                  Bank-Grade Encryption
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Instant Processing
                </span>
                <span className="flex items-center gap-1.5">
                   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                   Verified Merchants
                </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}