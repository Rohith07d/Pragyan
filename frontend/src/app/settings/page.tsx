"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getCurrentUser, logoutUser, api, AuthUser } from "@/lib/api";
import { Shield, User, KeyRound, LogOut, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [aliases, setAliases] = useState<any[]>([]);

  useEffect(() => {
    setUser(getCurrentUser());
    api.get("/api/aliases")
      .then((res) => setAliases(res.data || []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div>
            <p className="text-xs text-gray-500 font-medium">Preferences & Security</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Account Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage identity, privacy tokens, and security profiles.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span>User Profile</span>
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Canonical Name</span>
                  <span className="text-white font-medium">{user?.canonical_name || user?.name || "User"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Email Address</span>
                  <span className="text-white font-medium">{user?.email || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Access Role</span>
                  <span className="text-white font-medium uppercase">{user?.role || "user"}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => logoutUser()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>

            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Autonomous ASR Aliases</span>
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Phonetic misspellings registered for your profile to ensure transcript normalization before Presidio anonymization.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {aliases.length > 0 ? (
                  aliases.slice(0, 15).map((a, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
                    >
                      {a.alias_string || a.alias || a}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500 italic">No custom aliases recorded yet.</span>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
