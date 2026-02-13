import axios from "axios";
import { getServerSession } from "next-auth/next";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { authOptions } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // 60 seconds timeout for App Router

const TATUM_API_KEY = process.env.TATUM_API_KEY;
const TATUM_BASE = "https://api-eu1.tatum.io/v3";

type NetworkType = "erc20" | "bep20" | "trc20" | "polygon";

interface DepositAddressRequest {
  network: NetworkType;
}

interface DepositAddressResponse {
  address: string;
  isNew: boolean;
}

export async function POST(req: NextRequest) {
  console.log("📥 Incoming request:", {
    method: req.method,
    headers: req.headers,
  });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  
  if (!convexUrl) {
    console.error("❌ Missing NEXT_PUBLIC_CONVEX_URL");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const convex = new ConvexHttpClient(convexUrl);

  try {
    console.log("🔐 Checking authentication...");
    
    // 1. Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.contact) {
      console.error("❌ Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ User authenticated:", session.user.contact);

    const body = await req.json() as DepositAddressRequest;
    const { network } = body;

    if (!network) {
      console.error("❌ Missing network parameter");
      return NextResponse.json({ error: "Missing network parameter" }, { status: 400 });
    }

    console.log("📡 Getting user from Convex...");

    // 2. Get user from Convex
    const userContact = session.user.contact;
    const user = await convex.query(api.user.getUserByContact, {
      contact: userContact,
    });

    if (!user) {
      console.error("❌ User not found in Convex");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("✅ User found:", user._id);

    const userId = user._id;

    // 3. Check if user already has an address for this network
    console.log("🔍 Checking existing addresses...");
    
    const existingAddresses = await convex.query(
      api.deposit.getUserDepositAddresses,
      { userId }
    );

    console.log("📍 Existing addresses:", existingAddresses);

    if (existingAddresses && existingAddresses[network]) {
      console.log("✅ Address already exists:", existingAddresses[network]);
      return NextResponse.json({
        address: existingAddresses[network],
        isNew: false,
      }, { status: 200 });
    }

    // 4. Generate new address via Tatum
    console.log("🔧 Generating new address via Tatum...");
    
    const currency = getCurrencyForNetwork(network);

    if (!currency) {
      console.error("❌ Unsupported network:", network);
      return NextResponse.json({ error: "Unsupported network" }, { status: 400 });
    }

    console.log("📤 Calling Tatum API:", { currency, network });

    const tatumResponse = await axios.post(
      `${TATUM_BASE}/ledger/account`,
      {
        currency,
        customer: {
          externalId: userId,
          customerCountry: "US",
        },
      },
      {
        headers: {
          "x-api-key": TATUM_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Tatum response:", tatumResponse.data);

    const depositAddress = tatumResponse.data.address;
    const accountId = tatumResponse.data.id;

    if (!depositAddress) {
      throw new Error("No address returned from Tatum");
    }

    console.log("💾 Saving address to Convex...");

    // 5. Save to Convex database
    await convex.mutation(api.deposit.saveDepositAddress, {
      userId,
      network,
      address: depositAddress,
    });

    console.log("✅ Address saved successfully!");

    return NextResponse.json({
      address: depositAddress,
      isNew: true,
    }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Deposit address generation error:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });

    // Handle specific Tatum errors
    if (error.response?.status === 401) {
      return NextResponse.json({
        error: "API configuration error",
        details: "Invalid Tatum API key",
      }, { status: 500 });
    }

    if (error.response?.status === 403) {
      return NextResponse.json({
        error: "API limit reached",
        details: "Tatum API quota exceeded",
      }, { status: 500 });
    }

    return NextResponse.json({
      error: "Failed to generate deposit address",
      details:
        process.env.NODE_ENV === "development"
          ? error.response?.data || error.message
          : undefined,
    }, { status: 500 });
  }
}

function getCurrencyForNetwork(network: NetworkType): string | null {
  const networkMap: Record<NetworkType, string> = {
    erc20: "ETH",
    bep20: "BSC",
    trc20: "TRON",
    polygon: "MATIC",
  };

  return networkMap[network] || null;
}