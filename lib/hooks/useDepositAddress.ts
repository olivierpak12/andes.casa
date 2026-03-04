// hooks/useDepositAddress.ts
import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import toast from "react-hot-toast";
import type { Id } from "@/convex/_generated/dataModel";

interface UseDepositAddressProps {
  userId: Id<"user"> | undefined;
}

export function useDepositAddress({ userId }: UseDepositAddressProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reactive — updates automatically once the API route saves to Convex
  const depositAddresses = useQuery(
    api.deposit.getUserDepositAddresses,
    userId ? { userId } : "skip"
  );

  const generateAddress = useCallback(
    async (network: "trc20" | "bep20" | "erc20" | "polygon") => {
      if (!userId) {
        toast.error("User not authenticated");
        return null;
      }

      setGenerating(true);
      setError(null);

      try {
        // GET /api/deposit/address handles everything:
        // - returns existing address if already generated
        // - generates new address + saves address AND private key to Convex
        const response = await fetch("/api/tron/deposit/address");

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.depositAddress) {
          throw new Error("No address returned from server");
        }

        toast.success(data.isNew ? "New deposit address generated!" : "Deposit address loaded!");
        return data.depositAddress as string;

      } catch (err: any) {
        const msg = err.message || "Failed to get deposit address";
        setError(msg);
        toast.error(msg);
        console.error("[useDepositAddress]", err);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [userId]
  );

  return { depositAddresses, generating, error, generateAddress };
}