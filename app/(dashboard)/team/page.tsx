"use client"
import React from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import TeamReport from '@/components/TeamReport'
import InviteCard from '@/components/InviteCard'

const TeamPage = () => {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gray-50 font-montserrat text-gray-800">
      {/* Header: consistent, sticky, simple */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <Link href="/profile" className="inline-flex items-center text-gray-700 hover:opacity-80">← Back</Link>
            </div>
            <div className="text-center flex-1">
              <h1 className="text-lg font-semibold text-gray-900">Team report</h1>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </header>

      {/* Main content container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Responsive grid: main report + invite card on the side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <TeamReport />
            </div>
          </div>

          <aside className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 sticky top-20">
              <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Invite New Members</h3>
              <InviteCard userId={(session as any)?.user?.id ?? undefined} code={(session as any)?.user?.invitationCode ?? '2896064'} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default TeamPage


