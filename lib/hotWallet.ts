/**
 * Hot wallet management utilities
 * Tracks the centralized hot wallet balance in the database
 */

export const HOT_WALLET_CONFIG = {
  // System identifier for hot wallet
  CONTACT: "system-hot-wallet",
  DESCRIPTION: "Centralized USDT hot wallet for external transfers",
};

/**
 * Get or create hot wallet user account
 * This account tracks the balance of the centralized hot wallet
 */
export async function getOrCreateHotWalletUser(convex: any) {
  try {
    // Try to find existing hot wallet account
    const existingHotWallet = await convex.query('user', async (db: any) => {
      return db.query("user")
        .withIndex("by_contact", (q: any) => q.eq("contact", HOT_WALLET_CONFIG.CONTACT))
        .first();
    });

    if (existingHotWallet) {
      console.log('[HOT_WALLET] Found existing account:', existingHotWallet._id);
      return existingHotWallet;
    }

    // Create new hot wallet account if it doesn't exist
    console.log('[HOT_WALLET] Creating new hot wallet account...');
    const hotWalletId = await convex.mutation('user', async (db: any) => {
      return db.insert("user", {
        contact: HOT_WALLET_CONFIG.CONTACT,
        email: "system@hotwallet.local",
        fullname: "Hot Wallet System",
        balance: 0,
        role: "admin",
        createdAt: Date.now(),
      });
    });

    console.log('[HOT_WALLET] Created new hot wallet account:', hotWalletId);
    return { _id: hotWalletId, balance: 0, contact: HOT_WALLET_CONFIG.CONTACT };
  } catch (error) {
    console.error('[HOT_WALLET] Error getting/creating hot wallet:', error);
    throw error;
  }
}
