"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  Bell,
  CheckCircle2,
  Shield,
  Clock,
  Calendar,
  AlertTriangle,
  X,
  CheckCheck,
  ChevronRight,
  Sparkles,
  Inbox,
} from "lucide-react";

interface NotificationItem {
  id: string;
  category: "action" | "security" | "scheduler";
  title: string;
  desc: string;
  time: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    category: "security",
    title: "Presidio Dynamic Masking Executed",
    desc: "All canonical participant names neutralized to [PERSON_X] before cloud LLM batch intake.",
    time: "10m ago",
    read: false,
    actionUrl: "/meetings",
    actionLabel: "View Meeting",
  },
  {
    id: "n2",
    category: "action",
    title: "Personalized Action Item Assigned",
    desc: "Verify local Presidio PII token masking & SQLite task persistence. Assigned to you.",
    time: "35m ago",
    read: false,
    actionUrl: "/tasks",
    actionLabel: "View Task",
  },
  {
    id: "n3",
    category: "scheduler",
    title: "APScheduler Task Completed",
    desc: "Scheduled bot session ended. 7 action items extracted and persisted to SQLite.",
    time: "1h ago",
    read: false,
    actionUrl: "/meetings/1",
    actionLabel: "View Summary",
  },
  {
    id: "n4",
    category: "security",
    title: "100 Phonetic Aliases Synced",
    desc: "Autonomous generator added 100 speech-to-text error variants for all canonical attendees.",
    time: "2h ago",
    read: true,
    actionUrl: "/settings",
    actionLabel: "View Aliases",
  },
  {
    id: "n5",
    category: "action",
    title: "Deliverable Due Tomorrow at 5:00 PM",
    desc: "Deploy Discord and Slack webhook forwarders with zero-leak verification.",
    time: "4h ago",
    read: true,
    actionUrl: "/tasks",
    actionLabel: "Open Deliverable",
  },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "action" | "security" | "scheduler">("all");

  useEffect(() => {
    const saved = localStorage.getItem("aegis_notifications_store");
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveNotifications = (newList: NotificationItem[]) => {
    setNotifications(newList);
    try {
      localStorage.setItem("aegis_notifications_store", JSON.stringify(newList));
    } catch {}
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
  };

  const handleToggleRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: !n.read } : n
    );
    saveNotifications(updated);
  };

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    return n.category === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "security":
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case "action":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "scheduler":
        return <Clock className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-white" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Page Title & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Activity & Telemetry</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-2.5">
                <span>Notification Center</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black text-white">
                    {unreadCount} Unread
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time privacy boundary events, meeting batches, and task assignments.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5 text-gray-600" />
                <span>Mark All Read</span>
              </button>

              <button
                onClick={() => saveNotifications([])}
                disabled={notifications.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-red-600 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Alerts", count: notifications.length },
              {
                id: "action",
                label: "Action Items",
                count: notifications.filter((n) => n.category === "action").length,
              },
              {
                id: "security",
                label: "Security & Privacy",
                count: notifications.filter((n) => n.category === "security").length,
              },
              {
                id: "scheduler",
                label: "Scheduler & Bot",
                count: notifications.filter((n) => n.category === "scheduler").length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  filter === tab.id
                    ? "bg-black text-white font-semibold shadow-xs"
                    : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filter === tab.id
                      ? "bg-zinc-800 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Notifications List Container */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-3">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 space-y-2">
                <Inbox className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-zinc-400">All Caught Up</h3>
                <p className="text-xs text-zinc-500">
                  No notifications matching the selected filter.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleRead(item.id)}
                  className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    item.read
                      ? "bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900/60"
                      : "bg-zinc-900 border-zinc-700/80 text-white shadow-xs hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-zinc-800 text-white mt-0.5 border border-zinc-700">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold">{item.title}</h4>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                        <span className="text-[10px] text-zinc-500">{item.time}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {item.actionUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(item.actionUrl!);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
                      >
                        <span>{item.actionLabel || "View"}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDismiss(item.id, e)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
