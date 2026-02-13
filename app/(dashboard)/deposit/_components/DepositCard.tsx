export function DepositCard({
  loading,
  qrSrc,
  shortAddress,
  userAddress,
  copied,
  onCopy,
  depositInfo,
}: any) {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        
        {/* QR */}
        <div className="flex justify-center">
          <div className="w-56 h-56 border rounded-xl flex items-center justify-center">
            {loading ? (
              <span className="text-gray-400">Generating…</span>
            ) : (
              <img src={qrSrc} alt="QR Code" className="w-48 h-48" />
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Deposit Address</p>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm truncate">{shortAddress}</span>

              <button
                onClick={onCopy}
                disabled={!userAddress}
                className="px-3 py-1 text-xs rounded-md border border-cyan-500 text-cyan-600 hover:bg-cyan-50 disabled:opacity-50"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          <div className="text-xs bg-blue-50 p-3 rounded-lg border">
            <p><b>Network:</b> {depositInfo.network}</p>
            <p><b>Token:</b> {depositInfo.token}</p>
            <p><b>Minimum:</b> {depositInfo.minDeposit}</p>
          </div>

          <p className="text-xs text-gray-600">
            ⚠ Send only supported tokens on this network.  
            Deposits below minimum will not be credited.
          </p>
        </div>
      </div>
    </div>
  );
}
