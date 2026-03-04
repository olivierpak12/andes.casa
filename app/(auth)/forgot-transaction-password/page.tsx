"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/clientToast";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import Link from "next/link";

const ForgotTransactionPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-transaction-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        toastSuccess("If an account with that email exists, a reset link has been sent.", {
          richColors: true,
        });
      } else {
        setError(data.error || "Failed to process transaction password reset request.");
        toastError(data.error || "Failed to process transaction password reset request.", {
          richColors: true,
        });
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      toastError("Something went wrong. Please try again.", {
        richColors: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex items-center justify-center min-h-screen bg-[url('/images/bgimage.jpeg')] bg-cover bg-center bg-no-repeat px-4 w-full">
      <div className="bg-[url('/images/office.jpg')] absolute bg-cover bg-center bg-no-repeat h-full w-full opacity-40" />
      <div className="h-full w-full bg-indigo-900/10 rounded-md bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 z-50 absolute" />
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6 z-50">
        <h2 className="text-2xl font-bold text-indigo-900 text-center">
          Reset Transaction Password
        </h2>
        <p className="text-gray-600 text-center text-sm mb-4">
          Enter your email address and we'll send you a link to reset your transaction password.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-indigo-900 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50 text-indigo-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@example.com"
                required
              />
            </div>
            {error && (
              <div className="text-red-500 text-xs text-center">{error}</div>
            )}
            <Button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors disabled:opacity-60 cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-1 justify-center">
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                <span>Send Reset Link</span>
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-green-600 text-center text-sm">
              If an account with that email exists, a reset link has been sent to your inbox.
            </div>
            <p className="text-gray-600 text-center text-sm">
              Please check your email and click the reset link to proceed.
            </p>
          </div>
        )}

        <div className="text-center pt-4 space-y-2">
          <Link href="/sign-in">
            <button className="text-indigo-700 underline text-sm hover:text-indigo-900 transition-colors">
              Back to Login
            </button>
          </Link>
          <div className="text-sm text-gray-600">
            Need help with{" "}
            <Link href="/forgot-password">
              <span className="text-indigo-700 underline hover:text-indigo-900 transition-colors cursor-pointer">
                account password?
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForgotTransactionPasswordPage;
