import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3210";

export async function GET() {
  try {
    const convex = new ConvexHttpClient(convexUrl);

    // 1) Create inviter (user A)
    const countryCode = "+1";
    const stamp = Date.now().toString().slice(-6);
    const contactA = `+1555${stamp}1`;
    const password = "password123";
    const txPassword = "txpass123";

    // Register user A
    const resA: any = await convex.mutation(api.user.registerUser, {
      countryCode,
      password,
      confirmPassword: password,
      transactionPassword: txPassword,
      invitationCode: undefined,
      telegram: "@inviter",
      contact: contactA,
    });

    if (!resA || !resA.success) {
      return new Response(JSON.stringify({ error: 'Failed to register inviter', detail: resA }), { status: 500 });
    }

    // fetch inviter user to get invite code
    const inviter = await convex.query(api.user.getUserByContact, { contact: contactA });
    const inviteCode = inviter?.invitationCode;

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: 'Inviter has no invitationCode', inviter }), { status: 500 });
    }

    // 2) Register invitee (user B) using inviteCode
    const contactB = `+1555${stamp}2`;
    const resB: any = await convex.mutation(api.user.registerUser, {
      countryCode,
      password,
      confirmPassword: password,
      transactionPassword: txPassword,
      invitationCode: inviteCode,
      telegram: "@invitee",
      contact: contactB,
    });

    if (!resB || !resB.success) {
      return new Response(JSON.stringify({ error: 'Failed to register invitee', detail: resB }), { status: 500 });
    }

    // 3) Query team report for inviter
    const inviterUser = await convex.query(api.user.getUserByContact, { contact: contactA });
    const inviterId = inviterUser?._id;
    
    if (!inviterId) {
      return new Response(JSON.stringify({ error: 'Inviter user not found' }), { status: 404 });
    }
    
    const report = await convex.query(api.team.getTeamReport, { userId: inviterId });

    return new Response(JSON.stringify({ inviter: inviterUser, inviteCode, registerInvitee: resB, teamReport: report }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { status: 500 });
  }
}
