"use client";

import Link from "next/link";
import React, { useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";

const NavigationContent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  const links = [
    {
      name: "Home",
      href: "/",
    },
    {
      name: "About Us",
      href: "/about",
    },
    {
      name: "Anti-fraud",
      href: "/anti-fraud",
    },
    {
      name: "Occupation",
      href: "/occupation",
    },
    {
      name: "Joining process",
      href: "/joining-process",
    },
  ];

  return (
    <nav
      suppressHydrationWarning
      className="fixed top-0 left-0 right-0 flex justify-between items-center px-[5%] py-6 bg-gradient-to-b from-white/95 to-white/85 backdrop-blur-lg z-50 shadow-md"
    >
      <Link
        href="/"
        className="font-playfair text-3xl font-bold text-cyan-500 tracking-widest"
      >
        ANDES
      </Link>

      {/* Desktop Menu */}
      <ul className="hidden md:flex gap-10 list-none" suppressHydrationWarning>
        {links.map((item, index) => (
          <li key={index} suppressHydrationWarning>
            <Link
              href={item.href}
              className="text-gray-800 font-medium text-sm relative hover:text-cyan-500 transition-colors duration-300 after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-cyan-500 after:transition-all after:duration-300 hover:after:w-full"
            >
              <span>{item.name}</span>
            </Link>
          </li>
        ))}
        {/* Auth Links */}
        <li>
          {!session ? (
            <div className="flex gap-4 items-center">
              <Link
                href="/sign-in"
                className="text-sm text-gray-800 font-medium hover:text-cyan-500"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm text-white font-medium bg-cyan-500 px-3 py-1 rounded hover:opacity-90"
              >
                Register
              </Link>
            </div>
          ) : (
            <div className="flex gap-4 items-center">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="text-gray-800 font-medium text-sm relative hover:text-cyan-500 transition-colors duration-300 after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-cyan-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                {" "}
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: "/" })}
                className="text-sm text-white font-medium bg-red-500 px-3 py-1 rounded hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </li>
      </ul>

      {/* Mobile Menu Button */}
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2 relative z-50"
          aria-label="Toggle menu"
        >
          <span
            className={`w-6 h-0.5 bg-gray-800 transition-all ${isOpen ? "rotate-45 translate-y-2" : ""}`}
          ></span>
          <span
            className={`w-6 h-0.5 bg-gray-800 transition-all ${isOpen ? "opacity-0" : ""}`}
          ></span>
          <span
            className={`w-6 h-0.5 bg-gray-800 transition-all ${isOpen ? "-rotate-45 -translate-y-2" : ""}`}
          ></span>
        </button>

        {/* Mobile Menu */}
        {isOpen && (
          <ul
            className="absolute top-20 left-0 right-0 flex flex-col bg-white/95 backdrop-blur-lg list-none md:hidden shadow-lg"
            suppressHydrationWarning
          >
            {links.map((item, index) => (
              <li
                key={index}
                className="border-b border-gray-200 last:border-b-0"
                suppressHydrationWarning
              >
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-[5%] py-4 text-gray-800 font-medium hover:text-cyan-500 transition-colors"
                >
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
            {/* Mobile auth links */}
            <li className="border-b border-gray-200">
              {!session ? (
                <div className="flex flex-col px-[5%] py-4 gap-3">
                  <Link
                    href="/sign-in"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-800"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="text-white bg-cyan-500 px-3 py-2 rounded text-center"
                  >
                    Register
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col px-[5%] py-4 gap-3">
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-800"
                  >
                    {" "}
                    Dashboard
                  </Link>
                  <button
                    onClick={() =>
                      signOut({ redirect: true, callbackUrl: "/" })
                    }
                    className="w-full text-left px-[5%] py-4 text-white font-medium bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </li>
          </ul>
        )}
      </>
    </nav>
  );
};

const Navigation = () => {
  return (
    <Suspense fallback={<div className="h-20 bg-white/95 shadow-md" />}>
      <NavigationContent />
    </Suspense>
  );
};

export default Navigation;
