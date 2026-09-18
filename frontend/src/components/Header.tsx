"use client";

import { useState, useEffect } from "react";
import { Search, Bell, User as UserIcon, Shield } from "lucide-react";
import { getCurrentUser, AuthUser } from "@/lib/api";

export default function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-10">
      {/* Search Input matching reference image: Search.. */}
      <div className="relative w-80">
        <input
          type="text"
          placeholder="Search.."
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
        />
      </div>

      {/* Right controls: Notification with badge 3 and User profile */}
      <div className="flex items-center gap-6">
        {/* Notification with superscript 3 badge matching reference */}
        <div className="flex items-center gap-1 text-gray-700 text-xs font-medium cursor-pointer hover:text-gray-900 transition-colors relative">
          <Bell className="w-4 h-4 text-gray-600" />
          <span>Notification</span>
          <span className="ml-0.5 text-[10px] font-bold text-gray-900 bg-gray-100 rounded-full px-1.5 py-0.2 border border-gray-300">
            3
          </span>
        </div>

        {/* User profile avatar & label matching reference */}
        <div className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-800 hover:text-gray-950">
          <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-700">
            <UserIcon className="w-4 h-4 text-gray-600" />
          </div>
          <span>{user?.canonical_name || user?.name || "User"}</span>
          {user?.role === "admin" && (
            <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              Admin
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
