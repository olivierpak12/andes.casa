"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const Navbar = () => {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path);
  };
  const user = useQuery(api.user.getUserByContact, {
    contact: session?.user?.contact || "",
  });
  if (!user) {
    return null; // or a loading spinner
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md shadow-sm z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
            A
          </div>
          <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              ANDES
            </h1>
          </Link>
        </div>

        <ul className="hidden lg:flex gap-8 items-center list-none text-sm font-medium">
          <li>
            <Link
              href="/dashboard"
              className={`transition ${isActive('/dashboard') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              href="/tasks"
              className={`transition ${isActive('/tasks') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              My Tasks
            </Link>
          </li>
          <li>
            <Link
              href="/equipment"
              className={`transition ${isActive('/equipment') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              Equipment
            </Link>
          </li>
          <li>
            <Link
              href="/deposit"
              className={`transition ${isActive('/deposit') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              Deposit
            </Link>
          </li>
          <li>
            <Link
              href="/finances"
              className={`transition ${isActive('/finances') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              Finance
            </Link>
          </li>
          <li>
            <Link
              href="/team"
              className={`transition ${isActive('/team') ? 'text-emerald-600 font-semibold' : 'text-gray-600 hover:text-emerald-600'}`}
            >
              Team
            </Link>
          </li>
          <li>
            <Link
              href="/profile"
              className={`flex items-center gap-2 pl-6 border-l border-gray-200 transition ${isActive('/profile') ? 'text-emerald-600' : 'text-gray-700 hover:text-gray-900'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive('/profile') ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {user.fullname?.charAt(0) || user.contact?.charAt(0) || "U"}
              </div>
              <span className="ml-1">
                My Profile
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
