// pages/api/tron/generate-address.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateTronAddress } from "@/lib/tron/utils";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔐 Checking authentication...");
    
    // Verify authentication
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.contact) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("✅ User authenticated:", session.user.contact);

    // Get user from Convex
    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("👤 User found:", user._id);

    // Check if user already has a TRC20 address
    const existingAddress = user.depositAddresses?.trc20;
    
    if (existingAddress) {
      console.log("📍 Address already exists:", existingAddress);
      return res.status(200).json({
        address: existingAddress,
        isNew: false,
        network: 'trc20',
      });
    }

    console.log("🔧 Generating new TRON address...");

    // Generate new TRON address
    const { address, privateKey, hexAddress } = await generateTronAddress();

    console.log("✅ New address generated:", address);

    // IMPORTANT: In production, encrypt the private key before storing!
    // For now, we'll store it in a separate secure table
    
    // Save address to user's depositAddresses
    await convex.mutation(api.deposit.saveDepositAddress, {
      userId: user._id,
      network: 'trc20',
      address,
    });

    // Also save the private key securely (IMPORTANT: Encrypt in production!)
    // This should be in a separate, highly secured table
    // For testnet, we'll just log it (NEVER do this in production!)
    console.log("⚠️  TESTNET PRIVATE KEY:", privateKey);
    console.log("⚠️  SAVE THIS SECURELY! In production, encrypt before storing!");

    // TODO: Store private key encrypted in a secure vault
    // await convex.mutation(api.deposit.savePrivateKey, {
    //   userId: user._id,
    //   network: 'trc20',
    //   encryptedPrivateKey: encryptPrivateKey(privateKey),
    // });

    console.log("💾 Address saved to database");

    return res.status(200).json({
      address,
      hexAddress,
      isNew: true,
      network: 'trc20',
      // NEVER return private key to client!
      // privateKey is only logged for testnet debugging
    });

  } catch (error: any) {
    console.error("❌ Error generating TRON address:", error);
    
    return res.status(500).json({
      error: "Failed to generate TRON address",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}