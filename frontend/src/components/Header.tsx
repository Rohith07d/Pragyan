"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  User as UserIcon,
  Shield,
  CheckCircle2,
  Settings,
  CheckSquare,
  LogOut,
  Folder,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { getCurrentUser, logoutUser, AuthUser } from "@/lib/api";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const notifications = [
    {
      id: 1,
      title: "Presidio Dynamic Masking Executed",
      desc: "All participant names neutralized before cloud LLM intake.",
      time: "10m ago",
    },
    {
      id: 2,
      title: "APScheduler Job Ready",
      desc: "Meeting intake schedule verified for next session.",
      time: "1h ago",
    },
    {
      id: 3,
      title: "Phonetic Aliases Synced",
      desc: "Speech recognition error variants cached for zero-leak entity tracking.",
      time: "3h ago",
    },
  ];

  useEffect(() => {
    setUser(getCurrentUser());

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left side: Privacy Status Badge (Search bar removed per user specification) */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-xs font-semibold text-gray-700 tracking-tight">
          Aegis Air-Gapped Zero-Leak Shield
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium border border-gray-200">
          Protected
        </span>
      </div>

      {/* Right controls: Functional Notifications & Functional Profile */}
      <div className="flex items-center gap-6">
        {/* Functional Notification with Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="flex items-center gap-1.5 text-gray-700 hover:text-gray-950 text-xs font-medium cursor-pointer transition-colors p-1 rounded-lg hover:bg-gray-50"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-gray-600" />
            <span>Notification</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 text-[10px] font-bold text-gray-900 bg-gray-100 rounded-full px-1.5 py-0.2 border border-gray-300 shadow-2xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-black text-white px-1.5 py-0.2 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>

              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 hover:bg-gray-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                    onClick={() => {
                      setShowNotifications(false);
                      router.push("/notifications");
                    }}
                  >
                    <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 leading-tight">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                        {n.desc}
                      </p>
                      <span className="text-[9px] text-gray-400 mt-1 block">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-gray-100 bg-gray-50/80 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] font-semibold text-gray-700 hover:text-black block py-1"
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Functional Profile with Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-800 hover:text-gray-950 p-1 rounded-xl hover:bg-gray-50 transition-colors"
            aria-label="User Profile Menu"
          >
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-700 shadow-2xs">
              <UserIcon className="w-4 h-4 text-gray-600" />
            </div>
            <span className="font-semibold">{user?.canonical_name || user?.name || "User"}</span>
            {user?.role === "admin" && (
              <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                Admin
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {user?.canonical_name || user?.name || "User"}
                </p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {user?.email || "user@aegismeet.internal"}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                    {user?.role || "user"}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">● Verified Identity</span>
                </div>
              </div>

              <div className="p-1.5 space-y-0.5">
                <Link
                  href="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-500" />
                  <span>Account & Work Profile</span>
                </Link>

                <Link
                  href="/tasks"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-gray-500" />
                  <span>My Assigned Tasks</span>
                </Link>

                <Link
                  href="/projects"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  <Folder className="w-3.5 h-3.5 text-gray-500" />
                  <span>Enterprise Projects</span>
                </Link>
              </div>

              <div className="p-1.5 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => logoutUser()}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold w-full text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
