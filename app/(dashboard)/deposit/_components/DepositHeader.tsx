import Link from "next/link";

export function DepositHeader() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/dashboard" className="text-cyan-700 text-xl">
        ← Back
      </Link>

      <div className="bg-gradient-to-r from-green-400 to-cyan-400 px-6 py-2 rounded-full shadow">
        <h3 className="text-white font-semibold">Deposit USDT / USDC</h3>
      </div>

      <div className="opacity-0">•••</div>
    </div>
  );
}
