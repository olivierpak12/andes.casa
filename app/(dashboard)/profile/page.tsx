"use client"
import React, { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import Image from "next/image"

export default function ProfilePage() {
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)
  
  // Fetch detailed user data
  const user = useQuery(api.user.getUserByContact, { contact: session?.user?.contact || '' })

  const name = user?.fullname || session?.user?.name || session?.user?.firstName || "User"
  const email = user?.email || session?.user?.email || "—"
  const phone = user?.contact || (session?.user as any)?.phone || "—"
  const role = user?.role || "Member"
  const position = user?.position || "Partner"
  const country = user?.countryCode || "—"
  const joinDate = user?._creationTime ? new Date(user._creationTime).toLocaleDateString() : "—"

  const handleCopyCode = () => {
    const code = user?.invitationCode || (session as any)?.user?.invitationCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="font-montserrat text-gray-800 bg-[#F8FAFC] min-h-screen selection:bg-emerald-100 selection:text-emerald-800">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl shadow-[0_4px_30px_rgb(0,0,0,0.03)] z-50 border-b border-white/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-50">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">ANDES</h1>
            </div>
          </div>

          <ul className="hidden lg:flex gap-8 items-center list-none text-sm font-semibold">
            <li><Link href="/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors">Dashboard</Link></li>
            <li><Link href="/equipment" className="text-gray-500 hover:text-gray-900 transition-colors">Equipment</Link></li>
            <li><Link href="/finances" className="text-gray-500 hover:text-gray-900 transition-colors">Finance</Link></li>
            <li><Link href="/team" className="text-gray-500 hover:text-gray-900 transition-colors">Team</Link></li>
            <li>
                <Link href="/profile" className="flex items-center gap-2 pl-6 border-l border-gray-200 group text-emerald-600 relative after:content-[''] after:absolute after:-bottom-1 after:left-6 after:w-[calc(100%-1.5rem)] after:h-0.5 after:bg-emerald-500 after:rounded-full">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold ring-2 ring-emerald-50 shadow-sm transition-all">
                        {name.charAt(0)}
                    </div>
                    <span className="font-bold">My Profile</span>
                </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="pt-28 px-4 md:px-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
             <div>
                <h2 className="text-3xl font-bold text-gray-900">My Profile</h2>
                <p className="text-gray-500 mt-1">Manage your personal information and account settings.</p>
             </div>
             <button 
                onClick={() => signOut({
                  redirect: true
,
callbackUrl:'/'                }) } 
                className="px-5 py-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-100 font-semibold text-sm transition-all shadow-sm flex items-center gap-2"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Sign Out
             </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Profile Card */}
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 text-center relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500 to-teal-600"></div>
                  <div className="relative pt-12">
                     <div className="w-24 h-24 mx-auto bg-white p-1 rounded-2xl shadow-lg mb-4">
                        <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-4xl font-bold text-emerald-600">
                           {name.charAt(0)}
                        </div>
                     </div>
                     <h3 className="text-xl font-bold text-gray-900">{name}</h3>
                     <p className="text-sm text-gray-500 mb-4">{email}</p>
                     
                     <div className="flex justify-center gap-2 mb-6">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-100">
                           {role}
                        </span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
                           {position}
                        </span>
                     </div>
                     
                     <div className="border-t border-gray-100 pt-6 text-left space-y-3">
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Status</span>
                           <span className="font-semibold text-emerald-600 flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Verified
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Joined</span>
                           <span className="font-medium text-gray-900">{joinDate}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Country</span>
                           <span className="font-medium text-gray-900">{country}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-gray-500">Phone</span>
                           <span className="font-medium text-gray-900">{phone}</span>
                        </div>
                     </div>
                  </div>
               </div>
               
               {/* Invitation Code Mini Card */}
               <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                  </div>
                  <div className="relative">
                     <h4 className="text-lg font-bold mb-1">Invitation Code</h4>
                     <p className="text-indigo-100 text-xs mb-4">Share this code to grow your team</p>
                     
                     <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-3 py-2 font-mono text-center font-bold tracking-widest text-white">
                           {user?.invitationCode || (session as any)?.user?.invitationCode || '------'}
                        </div>
                        <button 
                           onClick={handleCopyCode}
                           className="p-2 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                           title="Copy Code"
                        >
                           {copied ? '✓' : '📋'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Right Column: Statistics & Actions */}
            <div className="lg:col-span-2 space-y-6">
               {/* Stats Grid */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100">
                     <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Balance</div>
                     <div className="text-2xl font-bold text-gray-900">
                        ${(user?.depositAmount || (session as any)?.user?.depositAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                     </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100">
                     <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">My Devices</div>
                     <div className="text-2xl font-bold text-gray-900">
                        1
                     </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100">
                     <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Team Size</div>
                     <div className="text-2xl font-bold text-gray-900">
                        {(user?.invitationCode || (session as any)?.user?.referrals || 0)}
                     </div>
                  </div>
               </div>

               {/* Quick Actions Grid */}
               <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Account Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <Link href="/profile/edit" className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-emerald-100 text-gray-500 group-hover:text-emerald-600 flex items-center justify-center text-xl transition-colors">
                           ✏️
                        </div>
                        <div>
                           <div className="font-bold text-gray-900">Edit Profile</div>
                           <div className="text-xs text-gray-500">Update personal details</div>
                        </div>
                        <div className="ml-auto text-gray-400 group-hover:text-emerald-500">→</div>
                     </Link>

                     <Link href="/team" className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-purple-100 text-gray-500 group-hover:text-purple-600 flex items-center justify-center text-xl transition-colors">
                           👥
                        </div>
                        <div>
                           <div className="font-bold text-gray-900">Team Report</div>
                           <div className="text-xs text-gray-500">Check referral status</div>
                        </div>
                        <div className="ml-auto text-gray-400 group-hover:text-purple-500">→</div>
                     </Link>

                     <Link href="/deposit" className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-emerald-100 text-gray-500 group-hover:text-emerald-600 flex items-center justify-center text-xl transition-colors">
                           💰
                        </div>
                        <div>
                           <div className="font-bold text-gray-900">Deposit</div>
                           <div className="text-xs text-gray-500">Add funds to wallet</div>
                        </div>
                        <div className="ml-auto text-gray-400 group-hover:text-emerald-500">→</div>
                     </Link>

                     <Link href="/withdraw" className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-blue-100 text-gray-500 group-hover:text-blue-600 flex items-center justify-center text-xl transition-colors">
                           💸
                        </div>
                        <div>
                           <div className="font-bold text-gray-900">Withdraw</div>
                           <div className="text-xs text-gray-500">Cash out earnings</div>
                        </div>
                        <div className="ml-auto text-gray-400 group-hover:text-blue-500">→</div>
                     </Link>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
