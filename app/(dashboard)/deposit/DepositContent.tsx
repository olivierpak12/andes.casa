"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { DepositCard } from "./_components/DepositCard";
import { NetworkSelector } from "./_components/NetworkSelector";
import { DepositHeader } from "./_components/DepositHeader";
import { TeamSection } from "./_components/TeamSection";
import { useDepositAddress } from "@/lib/hooks/useDepositAddress";

// Define auth states as constants
const AUTH_STATE = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
} as const;

export default function DepositContent() {
  const { data: session, status } = useSession();

  // Deposit state
  const [selectedNetwork, setSelectedNetwork] = useState<
    "trc20" | "bep20" | "erc20" | "polygon"
  >("trc20");
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState("");

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

  // Get current address for selected network
  const currentAddress = useMemo(() => {
    return depositAddresses?.[selectedNetwork] || "";
  }, [depositAddresses, selectedNetwork]);

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

  // Define networks
  const networks = useMemo(
    () => [
      { id: "trc20", label: "Tron•TRC20 [USDT/TRX]" },
      { id: "bep20", label: "BNB•BEP20 [USDT/USDC]" },
      { id: "erc20", label: "Ethereum•ERC20 [USDT/USDC]" },
      { id: "polygon", label: "Polygon•ERC20 [USDT/USDC]" },
    ],
    []
  );

  // Get deposit info based on network
  const depositInfo = useMemo(() => {
    const infoMap = {
      trc20: {
        network: "Tron (TRC20)",
        token: "USDT / TRX",
        minDeposit: 10,
      },
      bep20: {
        network: "BNB Chain (BEP20)",
        token: "USDT / USDC",
        minDeposit: 10,
      },
      erc20: {
        network: "Ethereum (ERC20)",
        token: "USDT / USDC",
        minDeposit: 50,
      },
      polygon: {
        network: "Polygon",
        token: "USDT / USDC",
        minDeposit: 10,
      },
    };

    return infoMap[selectedNetwork];
  }, [selectedNetwork]);

  // Format address for display
  const shortAddress = useMemo(() => {
    if (!currentAddress) return "";
    const start = currentAddress.slice(0, 8);
    const end = currentAddress.slice(-8);
    return `${start}...${end}`;
  }, [currentAddress]);

  // Generate address when network changes and no address exists
  useEffect(() => {
    if (
      authState === AUTH_STATE.AUTHENTICATED &&
      user?._id &&
      !currentAddress &&
      !generating
    ) {
      // Auto-generate address for the selected network
      generateAddress(selectedNetwork);
    }
  }, [authState, user?._id, currentAddress, generating, selectedNetwork, generateAddress]);

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
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy address");
      console.error("Copy failed:", error);
    }
  };

  // Handle network change
  const handleNetworkChange = (networkId: string) => {
    setSelectedNetwork(networkId as "trc20" | "bep20" | "erc20" | "polygon");
  };

  // Handle manual address generation (optional button)
  const handleGenerateAddress = async () => {
    await generateAddress(selectedNetwork);
  };

  const userName = user?.fullname || "User";

  // Loading State
  if (authState === AUTH_STATE.LOADING) {
    return (
      <main className="font-montserrat bg-gradient-to-br from-green-300 via-cyan-200 to-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-800">
                Loading Your Account
              </h3>
              <p className="text-sm text-gray-600">
                Please wait while we verify your session...
              </p>
            </div>

            <div className="flex gap-2">
              <div
                className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Unauthenticated State
  if (authState === AUTH_STATE.UNAUTHENTICATED) {
    return (
      <main className="font-montserrat bg-gradient-to-br from-green-300 via-cyan-200 to-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Authentication Required
          </h2>

          <p className="text-gray-600 mb-8 leading-relaxed">
            You need to be signed in to access deposit features and manage your
            ANDES account.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-in"
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 transform hover:scale-105"
            >
              Create Account
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            New to ANDES?{" "}
            <Link
              href="/about"
              className="text-cyan-600 hover:text-cyan-700 font-medium"
            >
              Learn more
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // Authenticated State - Show main content
  return (
    <main className="bg-gradient-to-br from-green-300 via-cyan-200 to-white min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-gray-600">
            Manage your deposits and track your team performance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN - Team Section */}
          <div className="space-y-6 animate-slide-in-left">
            {teamReport && (
              <TeamSection teamReport={teamReport} userName={userName} />
            )}
          </div>

          {/* RIGHT COLUMN - Deposit Section */}
          <div className="lg:col-span-2 space-y-6 animate-slide-in-right">
            <DepositHeader />

            <NetworkSelector
              networks={networks}
              selected={selectedNetwork}
              onSelect={handleNetworkChange}
            />

            <DepositCard
              loading={generating}
              qrSrc={qrSrc}
              shortAddress={shortAddress}
              userAddress={currentAddress}
              copied={copied}
              onCopy={handleCopy}
              depositInfo={depositInfo}
            />

            {/* Optional: Manual regenerate button */}
            {!generating && currentAddress && (
              <div className="text-center">
                <button
                  onClick={handleGenerateAddress}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-medium underline"
                >
                  Generate New Address
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}