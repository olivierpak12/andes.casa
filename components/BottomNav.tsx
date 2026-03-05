"use client"

import Link from 'next/link'
import React from 'react'

export default function BottomNav(){
  return (
    <nav className="fixed bottom-4 left-0 right-0 flex items-center justify-center z-50 pointer-events-none md:hidden">
      <div className="w-full max-w-md flex items-center justify-between px-6 bg-transparent pointer-events-auto">
        <Link href="/" className="flex-1 text-center text-gray-600 bg-white/80 rounded-full py-2 shadow-md hover:opacity-95">Home</Link>
        <div className="-mt-6">
          <Link href="/joining-process" className="inline-flex items-center justify-center w-16 h-16 bg-cyan-500 rounded-full shadow-lg text-white text-xl font-bold ring-4 ring-white hover:bg-cyan-600 transition-colors">
            Join
          </Link>
        </div>
        <Link href="/about" className="flex-1 text-center text-gray-600 bg-white/80 rounded-full py-2 shadow-md hover:opacity-95">About</Link>
      </div>
    </nav>
  )
}
