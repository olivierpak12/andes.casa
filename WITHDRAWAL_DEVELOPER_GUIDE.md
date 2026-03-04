# Withdrawal System - Developer Guide

## Overview

The withdrawal system has been redesigned to eliminate balance inconsistencies. The key principle is:

**Balance is deducted ONLY when withdrawal is confirmed successful on the blockchain.**

## File Changes

### 1. `convex/withdrawal.ts`
- **`requestWithdrawal()`**: Creates pending withdrawal transaction, validates balance, does NOT deduct
- **`completeWithdrawal()`**: Deducts balance on success, no action on failure

### 2. `convex/transaction.ts`
- **`createWithdrawal()`**: Same pattern as requestWithdrawal (validates, creates pending, no deduction)
- **`updateTransactionStatus()`**: Handles balance deduction for completed withdrawals

### 3. `app/api/tron/withdraw/route.ts`
- **No changes required** - This endpoint already handles the complete flow:
  1. Calls `requestWithdrawal()` to create pending
  2. Sends money to blockchain
  3. Calls `completeWithdrawal()` with status/hash

## Data Flow Example

### Successful Withdrawal ($50 from $100 balance)

```typescript
// Step 1: User initiates withdrawal
const txId = await requestWithdrawal({
  userId: "user123",
  amount: 50,
  address: "TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT",
  network: "trc20"
});
// ✓ Transaction created with status: "pending"
// ✗ Balance remains: $100 (unchanged)

// Step 2: Send to blockchain
// [... blockchain transaction processing ...]

// Step 3: Blockchain confirmed, complete withdrawal
await completeWithdrawal({
  transactionId: txId,
  status: "completed",
  transactionHash: "0x12345..."
});
// ✓ Balance updated: $100 - $50 = $50
// ✓ Transaction status: "completed"
```

### Failed Withdrawal ($50 from $100 balance)

```typescript
// Step 1: User initiates withdrawal
const txId = await requestWithdrawal({
  userId: "user123",
  amount: 50,
  address: "TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT",
  network: "trc20"
});
// ✓ Transaction created with status: "pending"
// ✗ Balance remains: $100 (unchanged)

// Step 2: Blockchain fails
// [... blockchain transaction fails ...]

// Step 3: Mark as failed
await completeWithdrawal({
  transactionId: txId,
  status: "failed",
  error: "Insufficient hot wallet balance"
});
// ✓ Balance remains: $100 (no deduction occurred)
// ✓ Transaction status: "failed"
// → User can retry the withdrawal
```

## Important: Balance Invariant

**For any user state:**
```typescript
user.balance = (funds_in_hot_wallet + funds_pending_withdrawals)
```

Since balance is only deducted on successful withdrawals, the `balance` field always represents:
- Actual funds available for withdrawal
- Funds that have been successfully sent out (reflected in completed withdrawals)

## Validation Rules

All withdrawal endpoints enforce:

1. **Minimum Amount Check** (in transaction creation)
   ```typescript
   const minAmount = MIN_WITHDRAWAL[network];
   if (amount < minAmount) throw error;
   ```

2. **Sufficient Balance Check**
   ```typescript
   const withdrawable = balance - lockedPrincipal;
   if (withdrawable < amount) throw error;
   ```

3. **One-Time Deduction** (only in `completeWithdrawal` on success)
   ```typescript
   if (status === "completed") {
     balance = balance - transaction.amount;
   }
   ```

## Common Scenarios

### Q: What if request succeeds but blockchain fails?
**A:** User keeps their balance. Request was pending but never deducted.

### Q: What if a withdrawal shows as "pending" forever?
**A:** Balance won't be deducted until status is marked "completed" or "failed". You should implement a cleanup process or timeout to mark old pending withdrawals as failed.

### Q: Can a user initiate multiple withdrawals simultaneously?
**A:** Yes! Multiple pending withdrawals can exist. Balance deduction only happens when each completes.
```
Balance: $100
Pending withdrawal 1: $30 (status: pending)
Pending withdrawal 2: $40 (status: pending)
User sees available: $100

When withdrawal 1 completes: Balance = $70
When withdrawal 2 completes: Balance = $30
```

### Q: What fields should I check to verify withdrawal status?
**A:**
- `transaction.status`: "pending", "completed", or "failed"
- `transaction.transactionHash`: Populated when status is "completed"
- `user.balance`: Only changes when status becomes "completed"

## Debugging Tips

### To find stuck withdrawals:
```typescript
const withdrawals = await convex.query(
  api.transaction.getTransactionHistory,
  { userId: "user123" }
);
const stuck = withdrawals.filter(tx => 
  tx.type === "withdrawal" && tx.status === "pending"
);
```

### To manually complete/recover a withdrawal:
```typescript
// Mark as completed if blockchain confirmed but app didn't
await convex.mutation(api.withdrawal.completeWithdrawal, {
  transactionId: "tx123",
  status: "completed",
  transactionHash: "0xabcd..."
});

// Or mark as failed to unblock user
await convex.mutation(api.withdrawal.completeWithdrawal, {
  transactionId: "tx123",
  status: "failed",
  error: "Manual recovery: network timeout"
});
```

## Related Files
- [convex/withdrawal.ts](../convex/withdrawal.ts) - Withdrawal mutations
- [convex/transaction.ts](../convex/transaction.ts) - Transaction mutations
- [app/api/tron/withdraw/route.ts](../app/api/tron/withdraw/route.ts) - Withdrawal endpoint
- [WITHDRAWAL_FIX_SUMMARY.md](./WITHDRAWAL_FIX_SUMMARY.md) - Detailed fix explanation
