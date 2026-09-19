"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getCurrentUser, logoutUser, AuthUser } from "@/lib/api";
import {
  User,
  LogOut,
  Briefcase,
  GitBranch,
  Code2,
  CheckCircle2,
  Building2,
  Edit3,
  Save,
  Activity,
  Layers,
} from "lucide-react";

interface WorkProfile {
  jobTitle: string;
  department: string;
  githubRepo: string;
  jobDescription: string;
  focusArea: string;
}

const USER_PROFILES: Record<string, WorkProfile> = {
  admin: {
    jobTitle: "Enterprise Systems Administrator",
    department: "Enterprise Security & Infrastructure",
    githubRepo: "https://github.com/aegis-enterprise/platform-governance",
    jobDescription:
      "Manage role-based access controls, organizational security postures, and multi-tenant pipeline deployments across internal engineering teams.",
    focusArea: "RBAC Governance, Security Auditing, Platform Operations",
  },
  rohith: {
    jobTitle: "Engineering Lead",
    department: "Core Security & Platform Architecture",
    githubRepo: "https://github.com/aegis-enterprise/core-privacy-pipeline",
    jobDescription:
      "Architect and maintain zero-leak PII anonymization boundaries, real-time closed-caption mutation streams, and autonomous meeting task routing for distributed team productivity.",
    focusArea: "Distributed Systems, PII Security, Presidio & ASR",
  },
  mayank: {
    jobTitle: "Tech Lead",
    department: "Backend Pipeline & Presidio Integration",
    githubRepo: "https://github.com/aegis-enterprise/presidio-airgap-gateway",
    jobDescription:
      "Lead backend architecture, live caption streaming ingestion, and token-level PII sanitization before cloud reasoning.",
    focusArea: "FastAPI, Presidio PII Masking, Featherless LLM Bridge",
  },
  sambhav: {
    jobTitle: "Frontend Specialist",
    department: "Design Systems & Console Experience",
    githubRepo: "https://github.com/aegis-enterprise/aegis-console-ui",
    jobDescription:
      "Build high-contrast, responsive enterprise interfaces, live meeting briefing hubs, and cross-client messaging systems.",
    focusArea: "Next.js, Tailwind CSS, Turbopack, Real-Time Collaboration",
  },
  sanjeet: {
    jobTitle: "Security Engineer",
    department: "Infosec & Zero-Leak Auditing",
    githubRepo: "https://github.com/aegis-enterprise/zero-leak-audits",
    jobDescription:
      "Perform continuous penetration tests, verify ephemeral memory scrubbing, and audit zero-leak cryptographic air-gaps.",
    focusArea: "Zero-Trust Architecture, Cryptographic Verification, RAM Scrubbing",
  },
  pranav: {
    jobTitle: "Cloud Systems Engineer",
    department: "Cloud Infrastructure & APScheduler",
    githubRepo: "https://github.com/aegis-enterprise/cloud-scheduler-infra",
    jobDescription:
      "Oversee containerized cloud execution, automated meeting scheduling jobs, and resilient tunnel proxy architecture.",
    focusArea: "Cloud Infrastructure, APScheduler, Microservices Reliability",
  },
};

const DEFAULT_PROFILE = USER_PROFILES.rohith;

function getUserSlug(user: AuthUser | null): string {
  if (!user) return "rohith";
  const name = (user.canonical_name || user.name || "").toLowerCase();
  if (name.includes("admin")) return "admin";
  if (name.includes("mayank")) return "mayank";
  if (name.includes("sambhav")) return "sambhav";
  if (name.includes("sanjeet")) return "sanjeet";
  if (name.includes("pranav")) return "pranav";
  return "rohith";
}

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<WorkProfile>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    const slug = getUserSlug(currentUser);
    const fallbackProfile = USER_PROFILES[slug] || DEFAULT_PROFILE;

    // Load persisted work profile for this specific user from localStorage
    const saved = localStorage.getItem(`aegis_work_profile_${slug}`);
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
        return;
      } catch {}
    }
    setProfile(fallbackProfile);
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = getUserSlug(user);
    localStorage.setItem(`aegis_work_profile_${slug}`, JSON.stringify(profile));
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div>
            <p className="text-xs text-gray-500 font-medium">Preferences & Security</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Account & Work Profile</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage enterprise identity, linked repositories, and productivity domain settings.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: User Identity & Enterprise Account */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>Identity & Access Tier</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Verified
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Canonical Name</span>
                    <span className="text-white font-medium">
                      {user?.canonical_name || user?.name || "User"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Company Email</span>
                    <span className="text-white font-medium">{user?.email || "user@aegismeet.internal"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Access Role</span>
                    <span className="text-white font-semibold uppercase">{user?.role || "user"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Organization</span>
                    <span className="text-white font-medium">Aegis Enterprise Inc.</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Employee ID</span>
                    <span className="text-zinc-300 font-mono text-[11px]">EMP-{(user?.id || 1) * 1042}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-400">Air-Gap Session Token</span>
                    <span className="text-emerald-400 font-mono text-[10px]">HMAC-SHA256 (Active)</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <button
                  onClick={() => logoutUser()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 text-xs font-semibold transition-colors cursor-pointer w-full justify-center"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>

            {/* Right Card: Enterprise Work Profile & Engineering Productivity Domain */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Work Profile & Productivity Domain</h2>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-zinc-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Work profile updated successfully.</span>
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      required
                      value={profile.jobTitle}
                      onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Department / Domain
                    </label>
                    <input
                      type="text"
                      required
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      GitHub Repository URL
                    </label>
                    <input
                      type="url"
                      required
                      value={profile.githubRepo}
                      onChange={(e) => setProfile({ ...profile, githubRepo: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Job Scope & Description
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={profile.jobDescription}
                      onChange={(e) => setProfile({ ...profile, jobDescription: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black text-xs font-semibold transition-colors cursor-pointer w-full"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Work Profile</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Designation & Team
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{profile.jobTitle}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{profile.department}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Linked GitHub Repository
                    </span>
                    <a
                      href={profile.githubRepo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <GitBranch className="w-4 h-4 text-white flex-shrink-0" />
                        <span className="font-mono truncate">{profile.githubRepo.replace(/^https?:\/\//, "")}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0 ml-2">
                        Connected
                      </span>
                    </a>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Job Scope & Responsibilities
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
                      {profile.jobDescription}
                    </p>
                  </div>

                  {/* Company Productivity Domain Stats */}
                  <div className="pt-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Productivity Domain Indicators
                    </span>
                    <div className="grid grid-cols-3 gap-2.5 mt-2">
                      <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-400 block">PRs Merged</span>
                        <span className="text-sm font-bold text-white mt-0.5 block">47</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-400 block">Review Latency</span>
                        <span className="text-sm font-bold text-white mt-0.5 block">&lt; 2.4h</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-400 block">Sprint Velocity</span>
                        <span className="text-sm font-bold text-emerald-400 mt-0.5 block">98.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
