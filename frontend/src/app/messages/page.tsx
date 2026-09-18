"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Mail } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div>
            <p className="text-xs text-gray-500 font-medium">Communication</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Messages</h1>
            <p className="text-xs text-gray-500 mt-0.5">Direct and team channels.</p>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-12 text-center shadow-xs">
            <Mail className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No New Messages</h3>
            <p className="text-xs text-zinc-400 mt-1">All meeting briefs and action alerts are up to date.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
