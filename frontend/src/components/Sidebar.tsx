"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Folder,
  Mail,
  Bell,
  Settings,
  LogOut,
  Video,
  Shield,
} from "lucide-react";
import { logoutUser } from "@/lib/api";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "Meetings", href: "/meetings", icon: Video },
  { name: "Messages", href: "/messages", icon: Mail },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col justify-between h-screen sticky top-0 px-4 py-6 z-20 select-none">
      <div>
        {/* AegisMeet Brand Logo & Name linking to /dashboard */}
        <div className="px-2 mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 tracking-tight leading-tight group-hover:text-gray-700 transition-colors">
                AegisMeet
              </span>
              <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                Enterprise Privacy
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname === "/");

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gray-100 text-gray-950 font-semibold shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-gray-900" : "text-gray-500"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout button at bottom left matching reference image */}
      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={() => logoutUser()}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4 text-gray-500" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
