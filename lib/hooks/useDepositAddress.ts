// hooks/useDepositAddress.ts

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import toast from "react-hot-toast";
import type { Id } from "@/convex/_generated/dataModel";

interface UseDepositAddressProps {
  userId: Id<"user"> | undefined;
}

interface GenerateAddressResult {
  address: string;
  isNew: boolean;
}

export function useDepositAddress({ userId }: UseDepositAddressProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query existing addresses
  const depositAddresses = useQuery(
    api.deposit.getUserDepositAddresses,
    userId ? { userId } : "skip"
  );

  // Mutation to save address to Convex
  const saveAddress = useMutation(api.deposit.saveDepositAddress);

  // Generate new deposit address
  const generateAddress = useCallback(
    async (network: "erc20" | "bep20" | "trc20" | "polygon") => {
      if (!userId) {
        toast.error("User not authenticated");
        return null;
      }

      setGenerating(true);
      setError(null);

      try {
        // Call API route to generate address
        const response = await fetch("/api/tron/generate-address", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ network }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate address");
        }

        const data: GenerateAddressResult = await response.json();

        // If it's a new address, save it to Convex
        if (data.isNew) {
          await saveAddress({
            userId,
            network,
            address: data.address,
          });

          toast.success("New deposit address generated!");
        } else {
          toast.success("Deposit address loaded!");
        }

        return data.address;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to generate deposit address";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Deposit address generation error:", err);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [userId, saveAddress]
  );

  return {
    depositAddresses,
    generating,
    error,
    generateAddress,
  };
}