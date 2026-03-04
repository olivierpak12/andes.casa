import toast from "react-hot-toast";

export function DepositCard({
  loading,
  checking,
  qrSrc,
  shortAddress,
  userAddress,
  copied,
  onCopy,
  depositInfo,
  walletBalance,
  onCheckDeposit,
  onGenerateAddress,
}: any) {
  // Determine activation status
  const isTrone = depositInfo.id === 'trc20';
  const trxBalance = walletBalance?.trx ?? 0;
  const usdtBalance = walletBalance?.usdt ?? 0;
  const totalUsdt = walletBalance?.totalUsdt ?? 0; // Use the combined total if available
  
  const showActivationWarning = isTrone && walletBalance !== null && trxBalance < 1;

  if (loading && !checking) {
     return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 relative">
               <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
               <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 animate-spin"></div>
            </div>
            <p className="mt-6 text-slate-500 font-medium tracking-wide">Generating secure address...</p>
        </div>
     );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. STATUS BANNER */}
      

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* QR CODE SECTION */}
        <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={() => { navigator.clipboard.writeText(userAddress); toast.success("Address Copied") }}>
                {/* QR Glow */}
                <div className="absolute -inset-2 bg-gradient-to-br from-cyan-200 to-indigo-200 rounded-2xl blur opacity-0 group-hover:opacity-50 transition duration-500"></div>
                
                <div className="relative w-full aspect-square max-w-[220px] bg-white p-4 rounded-xl border border-slate-100 shadow-xl transition-transform duration-300 group-hover:scale-[1.02]">
                    {qrSrc ? (
                      <div className="bg-white p-1 rounded-lg h-full w-full">
                        <img src={qrSrc} alt="Deposit QR Code" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 border border-slate-200 border-dashed">
                        <span>Generating QR...</span>
                      </div>
                    )}
                    
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/40 transition-all rounded-xl backdrop-blur-[2px] opacity-0 group-hover:opacity-100">
                        <span className="bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                            Click to Copy Address
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Manual Refresh / Generate */}
            {onGenerateAddress && (
              <button 
                onClick={onGenerateAddress}
                className="mt-5 text-xs text-slate-400 hover:text-cyan-600 flex items-center gap-1.5 transition-colors group"
              >
                <svg className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Generate New Address
              </button>
            )}
        </div>

        {/* DETAILS SECTION */}
        <div className="md:col-span-7 space-y-7">
          
          {/* Address Box */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-slate-600">
                    Deposit Address
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded uppercase tracking-wider">
                    {depositInfo.token} Recommended
                </span>
            </div>
            
            <div className="relative group">
              <input 
                readOnly
                value={userAddress}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono p-4 pr-24 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all group-hover:border-slate-300"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <button
                  onClick={onCopy}
                  className={`
                      px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                      ${copied 
                          ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" 
                          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-sm"
                      }
                  `}
                  >
                  {copied ? "Copied" : "Copy"}
                  </button>
              </div>
            </div>
            <div className="flex justify-between items-center px-1">
                <p className="text-xs text-slate-500">
                    Network: <span className="text-slate-700 font-medium">{depositInfo.network}</span>
                </p>
                <p className="text-xs text-slate-500">
                    Min Deposit: <span className="text-slate-700 font-medium">{depositInfo.minDeposit} USDT</span>
                </p>
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {/* Action Area */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden">
             
             <div className="relative flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-600">Transaction Status</span>
                <span className="flex items-center gap-1.5 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-500 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                    Auto-refreshing
                </span>
             </div>
             
             <button
                onClick={onCheckDeposit}
                disabled={checking}
                className="relative w-full group overflow-hidden bg-gradient-to-r from-cyan-600 to-indigo-600 text-white p-4 rounded-xl font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed border border-transparent"
             >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                
                <div className="relative flex items-center justify-center gap-2.5">
                    {checking ? (
                        <>
                           <svg className="animate-spin h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           <span className="tracking-wide text-sm">Scanning Blockchain...</span>
                        </>
                    ) : (
                        <>
                           <svg className="w-5 h-5 text-cyan-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                           <span className="tracking-wide text-sm">Check for New Deposits</span>
                        </>
                    )}
                </div>
             </button>
             
             <p className="text-[10px] text-center text-slate-400 mt-3.5">
                 Funds are typically credited within <span className="text-slate-600 font-medium">1-3 minutes</span> of network confirmation.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}
