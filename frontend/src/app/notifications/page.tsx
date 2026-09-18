"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Bell, CheckCircle2, ShieldAlert } from "lucide-react";

export default function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      title: "Presidio Dynamic Masking Executed",
      desc: "Transcripts filtered: all canonical participant names neutralized to [PERSON].",
      time: "10m ago",
      type: "shield",
    },
    {
      id: 2,
      title: "APScheduler Task Completed",
      desc: "Scheduled bot session ended. 12 action items extracted and persisted.",
      time: "1h ago",
      type: "check",
    },
    {
      id: 3,
      title: "Phonetic Aliases Auto-Generated",
      desc: "Autonomous generator added 15 phonetic misspellings for canonical participants.",
      time: "3h ago",
      type: "check",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div>
            <p className="text-xs text-gray-500 font-medium">Activity Log</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Notifications</h1>
            <p className="text-xs text-gray-500 mt-0.5">Privacy boundary and task assignment alerts.</p>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-white mt-0.5">
                  <Bell className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">{n.title}</h4>
                    <span className="text-[10px] text-zinc-500">{n.time}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
