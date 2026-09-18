"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your username/email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await loginUser(identifier, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Invalid credentials. Please verify your username and password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col justify-center items-center px-4 font-sans text-gray-900">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black text-white shadow-md mb-2">
            <Shield className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">AegisMeet</h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Zero-Leak Privacy Meeting Intelligence & Enterprise Task Governance
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-semibold text-gray-900">Sign In to Your Account</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter your credentials to access your isolated workspace.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. Rohith, Mayank, Admin"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-gray-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? "Verifying Credentials..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <div className="text-center text-[11px] text-gray-400">
          Protected by AegisMeet Air-Gapped Zero-Leak Boundary.
        </div>
      </div>
    </div>
  );
}
