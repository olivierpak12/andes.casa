import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { count } from "console";

/**
 * Simple custom hash function matching convex/user.ts
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3210";
const convex = new ConvexHttpClient(convexUrl);

console.log("[convex-auth] Using Convex URL:", convexUrl);

export async function POST(request: Request) {
  try {
    const { contact, password, countryCode } = await request.json();

    console.log("[convex-auth] Attempting authentication for:", contact);

    if (!contact || !password) {
      console.log("[convex-auth] Missing contact or password");
      return Response.json(
        { error: "contact and password are required" },
        { status: 400 }
      );
    }

    // Fetch user from Convex
    let user;
    try {
      console.log("[convex-auth] Querying Convex for user:", contact);
      user = await convex.query(api.user.getUserByContact, { contact: contact });
    } catch (error) {
      // User not found is expected behavior
      console.log("[convex-auth] Convex query error:", error);
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user) {
      console.log("[convex-auth] User is null");
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password
    console.log("[convex-auth] Verifying password");
    const isCountryCodeValid = user.countryCode === countryCode;
    // Compare password using simple hash function
    const hashedInput = simpleHash(password);
    const isPasswordValid = hashedInput === (user.password || "");

    if (!isCountryCodeValid) {
      console.log("[convex-auth] Country code verification failed",countryCode,typeof(countryCode));
      return Response.json(
        { error: "Invalid country code" },
        { status: 401 }
      );
    }
    if (!isPasswordValid) {
      console.log("[convex-auth] Password verification failed");
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("[convex-auth] Authentication successful for:", contact);
    return Response.json({
      user: {
        id: user._id,
        contact: user.contact,
        role: user.role || "",
        invitationCode: user.invitationCode || "",
        invitationExpiry: user.invitationExpiry || undefined,
      },
    });
  } catch (error: any) {
    console.error("[convex-auth] Unexpected error:", error);
    return Response.json(
      { error: error?.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
