"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  Calendar,
  Video,
  PhoneOff,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  Bell,
  Sparkles,
  ListTodo,
  CheckSquare,
  Square,
  Users,
  LogOut,
  Lock,
  Mail,
  Crown,
  ArrowRight,
  KeyRound,
} from "lucide-react";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "http://localhost:8000";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
}

interface TaskItem {
  id: number;
  task: string;
  assignee?: string;
  assignee_token?: string;
  deadline: string;
  status: "completed" | "pending";
  created_at?: string;
}

interface UserAlert {
  id: string;
  task_id: number;
  title: string;
  message: string;
  deadline: string;
  severity: "high" | "medium";
  type: string;
  created_at?: string;
}

interface UserDashboardData {
  user_name: string;
  stats: {
    total_tasks: number;
    pending_tasks: number;
    completed_tasks: number;
    alerts_count: number;
  };
  alerts: UserAlert[];
  tasks: TaskItem[];
  personalized_briefing: string;
}

interface MeetingSummary {
  meeting_title?: string;
  timestamp?: string;
  meeting_summary?: string;
  key_topics?: string[];
}

interface BotStatus {
  active: boolean;
  meet_url: string | null;
  bot_name: string | null;
  admitted: boolean;
  captions_captured: number;
  duration_sec: number;
}

export default function AegisMeetApp() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Participants & Admin Switcher State
  const [participants, setParticipants] = useState<string[]>(["Rohith", "Mayank", "Sambhav"]);
  const [activeProfileView, setActiveProfileView] = useState<string>("Rohith");

  // User Dashboard Data
  const [userData, setUserData] = useState<UserDashboardData | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");

  // Admin Team Overview State
  const [allTeamTasks, setAllTeamTasks] = useState<TaskItem[]>([]);
  const [showTeamOverview, setShowTeamOverview] = useState<boolean>(false);

  // Latest Meeting Recap
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);

  // Bot Controller State
  const [meetUrlInput, setMeetUrlInput] = useState<string>("");
  const [botStatus, setBotStatus] = useState<BotStatus>({
    active: false,
    meet_url: null,
    bot_name: null,
    admitted: false,
    captions_captured: 0,
    duration_sec: 0,
  });
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [botMessage, setBotMessage] = useState<string | null>(null);

  // Add Task State
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskText, setNewTaskText] = useState<string>("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>("Tomorrow at 5:00 PM");
  const [isSubmittingTask, setIsSubmittingTask] = useState<boolean>(false);

  // Check saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aegis_auth_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        setActiveProfileView(parsed.name || "Rohith");
      }
    } catch (e) {
      console.error("Failed to load saved session:", e);
    }
  }, []);

  // Fetch Participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/participants`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setParticipants(res.data);
      }
    } catch (e) {
      console.error("Failed to fetch participants:", e);
    }
  }, []);

  // Fetch User Dashboard Data for a specific participant
  const fetchUserDashboard = useCallback(async (targetName: string) => {
    if (!targetName) return;
    setLoadingUser(true);
    try {
      const res = await axios.get(`${PROXY_URL}/api/user/${encodeURIComponent(targetName)}/dashboard`);
      setUserData(res.data);
    } catch (e) {
      console.error(`Failed to fetch dashboard for ${targetName}:`, e);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Fetch Global Tasks & Summary
  const fetchGlobalData = useCallback(async () => {
    try {
      const [tasksRes, meetingRes] = await Promise.all([
        axios.get(`${PROXY_URL}/api/tasks`),
        axios.get(`${PROXY_URL}/api/latest-result`),
      ]);
      setAllTeamTasks(tasksRes.data || []);
      setMeetingSummary(meetingRes.data || null);
    } catch (e) {
      console.error("Failed to fetch global data:", e);
    }
  }, []);

  // Poll Bot Status
  const pollBotStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/bot/status`);
      setBotStatus(res.data);
    } catch (e) {
      // Server may be busy or reloading
    }
  }, []);

  // Sync profile view with active user role
  useEffect(() => {
    if (currentUser) {
      fetchParticipants();
      fetchGlobalData();
      if (currentUser.role === "user") {
        // Regular users can only view their own profile
        setActiveProfileView(currentUser.name);
        setShowTeamOverview(false);
        setNewTaskAssignee(currentUser.name);
      } else {
        // Admin defaults to their own profile or first available
        setNewTaskAssignee(activeProfileView);
      }
    }
  }, [currentUser, fetchParticipants, fetchGlobalData, activeProfileView]);

  // Load dashboard when activeProfileView changes
  useEffect(() => {
    if (currentUser && activeProfileView) {
      fetchUserDashboard(activeProfileView);
    }
  }, [currentUser, activeProfileView, fetchUserDashboard]);

  // Periodic bot polling
  useEffect(() => {
    if (!currentUser) return;
    pollBotStatus();
    const interval = setInterval(pollBotStatus, 3500);
    return () => clearInterval(interval);
  }, [currentUser, pollBotStatus]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please provide both email and password.");
      return;
    }
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await axios.post(`${PROXY_URL}/api/auth/login`, {
        email: authEmail.trim(),
        password: authPassword.trim(),
      });
      const user = res.data.user;
      setCurrentUser(user);
      setActiveProfileView(user.name);
      localStorage.setItem("aegis_auth_user", JSON.stringify(user));
      if (res.data.token) {
        localStorage.setItem("aegis_auth_token", res.data.token);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || "Authentication failed. Please verify your credentials.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Quick Demo Login Shortcut
  const handleQuickDemoLogin = async (email: string, pass: string) => {
    setAuthEmail(email);
    setAuthPassword(pass);
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await axios.post(`${PROXY_URL}/api/auth/login`, {
        email: email,
        password: pass,
      });
      const user = res.data.user;
      setCurrentUser(user);
      setActiveProfileView(user.name);
      localStorage.setItem("aegis_auth_user", JSON.stringify(user));
      if (res.data.token) {
        localStorage.setItem("aegis_auth_token", res.data.token);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || "Demo sign-in failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("aegis_auth_user");
    localStorage.removeItem("aegis_auth_token");
    setAuthEmail("");
    setAuthPassword("");
    setUserData(null);
  };

  // Toggle Task Status (Completed <-> Pending)
  const handleToggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";

    // Optimistic UI update in userData
    if (userData) {
      const updatedTasks = userData.tasks.map((t) =>
        t.id === task.id ? { ...t, status: nextStatus as "completed" | "pending" } : t
      );
      const pendingCount = updatedTasks.filter((t) => t.status !== "completed").length;
      const completedCount = updatedTasks.filter((t) => t.status === "completed").length;
      const updatedAlerts = userData.alerts.filter((a) =>
        nextStatus === "completed" ? a.task_id !== task.id : true
      );

      setUserData({
        ...userData,
        tasks: updatedTasks,
        alerts: updatedAlerts,
        stats: {
          ...userData.stats,
          pending_tasks: pendingCount,
          completed_tasks: completedCount,
          alerts_count: updatedAlerts.length,
        },
      });
    }

    setAllTeamTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus as "completed" | "pending" } : t))
    );

    try {
      await axios.patch(`${PROXY_URL}/api/tasks/${task.id}`, { status: nextStatus });
    } catch (e) {
      console.error("Failed to update task status:", e);
      fetchUserDashboard(activeProfileView);
    }
  };

  // Create New Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    setIsSubmittingTask(true);
    const targetAssignee = newTaskAssignee.trim() || activeProfileView;
    try {
      await axios.post(`${PROXY_URL}/api/tasks`, {
        task: newTaskText.trim(),
        assignee: targetAssignee,
        deadline: newTaskDeadline.trim() || "Tomorrow",
      });
      setNewTaskText("");
      setIsAddingTask(false);
      await Promise.all([
        fetchUserDashboard(activeProfileView),
        fetchGlobalData(),
        fetchParticipants(),
      ]);
    } catch (e) {
      console.error("Failed to create task:", e);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: number) => {
    try {
      await axios.delete(`${PROXY_URL}/api/tasks/${taskId}`);
      await Promise.all([fetchUserDashboard(activeProfileView), fetchGlobalData()]);
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  };

  // Bot Join Meeting
  const handleJoinMeeting = async () => {
    if (!meetUrlInput.trim()) return;
    setIsJoining(true);
    setBotMessage(null);
    try {
      const res = await axios.post(`${PROXY_URL}/api/join`, {
        meet_url: meetUrlInput.trim(),
      });
      setBotMessage(res.data.message || "Assistant dispatched to Google Meet!");
      setMeetUrlInput("");
      setTimeout(pollBotStatus, 1500);
    } catch (e: any) {
      setBotMessage(e.response?.data?.detail || "Failed to join meeting. Verify proxy is running.");
    } finally {
      setIsJoining(false);
    }
  };

  // Bot Leave Meeting & Process Briefing
  const handleLeaveMeeting = async () => {
    setIsLeaving(true);
    setBotMessage("Assistant leaving call and synthesizing zero-leak briefing...");
    try {
      await axios.post(`${PROXY_URL}/api/bot/leave`);
      setTimeout(async () => {
        await Promise.all([
          fetchUserDashboard(activeProfileView),
          fetchGlobalData(),
          fetchParticipants(),
          pollBotStatus(),
        ]);
        setIsLeaving(false);
        setBotMessage("Meeting finalized! Personalized action items and alerts refreshed.");
      }, 3000);
    } catch (e: any) {
      setIsLeaving(false);
      setBotMessage(e.response?.data?.detail || "Failed to leave meeting.");
    }
  };

  // ============================================================================
  // VIEW 1: AUTHENTICATION LOGIN PORTAL (When not logged in)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-emerald-500/30">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-md w-full space-y-8 relative z-10">
          {/* Product Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/25 mb-2">
              <ShieldCheck className="w-9 h-9 text-slate-950 stroke-[2.5]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">AegisMeet</h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Privacy-Preserving Intelligent Meeting Companion & Personalized Action Portals
            </p>
          </div>

          {/* Login Form Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Sign In to Your Workspace
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each participant accesses their isolated portal with personal alerts and tasks.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Gmail / Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmittingAuth ? "Authenticating..." : "Sign In to Workspace"}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>

            {/* Quick 1-Click Demo Logins */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Or Quick Sign-In With Demo Accounts
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("rohith@gmail.com", "rohith123")}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 text-left transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px]">
                    R
                  </span>
                  <div>
                    <div className="font-semibold text-white">Rohith</div>
                    <div className="text-[10px] text-slate-400">User Portal</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("mayank@gmail.com", "mayank123")}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 text-left transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[11px]">
                    M
                  </span>
                  <div>
                    <div className="font-semibold text-white">Mayank</div>
                    <div className="text-[10px] text-slate-400">User Portal</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("sambhav@gmail.com", "sambhav123")}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 text-left transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px]">
                    S
                  </span>
                  <div>
                    <div className="font-semibold text-white">Sambhav</div>
                    <div className="text-[10px] text-slate-400">User Portal</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("admin@gmail.com", "admin123")}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-300 text-left transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-amber-300">Admin</div>
                    <div className="text-[10px] text-amber-400/70">Full Access</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            🔒 Protected by Local Zero-Leak Proxy Architecture & Localhost Storage
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2 & 3: AUTHENTICATED APPLICATION (User Isolated View or Admin Full View)
  // ============================================================================
  const isAdmin = currentUser.role === "admin";
  const displayedUser = isAdmin && showTeamOverview ? "All Team" : activeProfileView;

  // Filter tasks for the active view
  const filteredTasks = (userData?.tasks || []).filter((task) => {
    if (taskFilter === "pending") return task.status !== "completed";
    if (taskFilter === "completed") return task.status === "completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">AegisMeet</span>
                {isAdmin ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Admin Console
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Zero-Leak Local Proxy
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isAdmin
                  ? "Admin View: Full team monitoring & cross-functional workspace"
                  : `Personalized Meeting Portal for ${currentUser.name}`}
              </p>
            </div>
          </div>

          {/* Right Navigation Elements */}
          <div className="flex items-center space-x-3">
            {/* ADMIN ONLY: Switcher between team members or team overview */}
            {isAdmin && (
              <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 shadow-inner">
                <span className="text-[11px] font-semibold text-slate-400 px-2 hidden lg:inline">
                  Viewing:
                </span>
                {participants.map((person) => {
                  const isActive = activeProfileView.toLowerCase() === person.toLowerCase() && !showTeamOverview;
                  return (
                    <button
                      key={person}
                      onClick={() => {
                        setActiveProfileView(person);
                        setShowTeamOverview(false);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md"
                          : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                      }`}
                    >
                      {person}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowTeamOverview(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    showTeamOverview
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-md"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
                  }`}
                  title="View All Team Tasks"
                >
                  All Team
                </button>
              </div>
            )}

            {/* Refresh Data */}
            <button
              onClick={() => {
                fetchUserDashboard(activeProfileView);
                fetchGlobalData();
                fetchParticipants();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Google Meet Assistant Live Controller */}
        <section className="bg-gradient-to-r from-slate-900/90 via-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-slate-950/40">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  botStatus.active
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700/60"
                }`}
              >
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">Google Meet Live Assistant</h2>
                  {botStatus.active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      In Meeting ({botStatus.captions_captured} caption chunks captured)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                      Assistant Ready
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {botStatus.active
                    ? `Active in: ${botStatus.meet_url || "Google Meet Call"} • Real-time continuous captions and PII scrubbing on localhost.`
                    : "Enter any Google Meet URL. Captures live speech chunks, detects deadlines, and automatically routes alerts."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {botStatus.active ? (
                <button
                  onClick={handleLeaveMeeting}
                  disabled={isLeaving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-600/25 disabled:opacity-50"
                >
                  <PhoneOff className="w-4 h-4" />
                  {isLeaving ? "Leaving & Finalizing..." : "Leave Call & Generate Briefing"}
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={meetUrlInput}
                    onChange={(e) => setMeetUrlInput(e.target.value)}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    className="w-full sm:w-72 px-3.5 py-2 text-xs rounded-xl bg-slate-950/80 border border-slate-700/70 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={handleJoinMeeting}
                    disabled={isJoining || !meetUrlInput.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex-shrink-0"
                  >
                    <Video className="w-3.5 h-3.5 stroke-[2.5]" />
                    {isJoining ? "Joining..." : "Join Meet"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {botMessage && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {botMessage}
              </span>
              <button
                onClick={() => setBotMessage(null)}
                className="text-slate-500 hover:text-slate-300 text-[11px]"
              >
                Dismiss
              </button>
            </div>
          )}
        </section>

        {/* Personalized User Workspace Header (For regular user or selected user in Admin view) */}
        {!showTeamOverview ? (
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-emerald-500/20">
                  {displayedUser.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {displayedUser}&apos;s Personalized Portal
                    </h1>
                    {isAdmin && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Admin Viewing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    {userData?.personalized_briefing ||
                      `Tailored updates, upcoming deadlines, and assigned action items from your team meetings.`}
                  </p>
                </div>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <div className="text-xl font-extrabold text-amber-400">
                    {userData?.stats.alerts_count ?? 0}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                    Alerts
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <div className="text-xl font-extrabold text-teal-400">
                    {userData?.stats.pending_tasks ?? 0}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                    Pending
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <div className="text-xl font-extrabold text-emerald-400">
                    {userData?.stats.completed_tasks ?? 0}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                    Done
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Admin Cross-Functional Team Overview Banner */
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Admin: Team Cross-Functional Overview
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Comprehensive overview of all action items, assignees, and deadlines across the entire engineering team.
                </p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Total Team Deliverables: <span className="font-bold text-white">{allTeamTasks.length}</span>
              </div>
            </div>
          </section>
        )}

        {/* High-Priority Alerts Section (Only for Individual Profile View) */}
        {!showTeamOverview && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Priority Alerts for {displayedUser}
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {userData?.alerts.length || 0} active notification
                {(userData?.alerts.length || 0) === 1 ? "" : "s"}
              </span>
            </div>

            {loadingUser ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 animate-pulse">
                Loading personalized alerts...
              </div>
            ) : !userData?.alerts || userData.alerts.length === 0 ? (
              <div className="bg-slate-900/30 border border-slate-800/70 rounded-xl p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>All clear! No urgent alerts or overdue deliverables for {displayedUser}.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {userData.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl p-4 border transition-all duration-150 flex items-start justify-between gap-3 ${
                      alert.severity === "high"
                        ? "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
                        : "bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          alert.severity === "high"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {alert.severity === "high" ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-white">{alert.title}</h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                              alert.severity === "high"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 font-semibold text-slate-300">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {alert.deadline}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const targetTask = userData.tasks.find((t) => t.id === alert.task_id);
                        if (targetTask) {
                          handleToggleTaskStatus(targetTask);
                        }
                      }}
                      className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition-colors border border-slate-700/80"
                      title="Mark Task as Completed"
                    >
                      Complete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Main Grid: Action Items & Sync Digest */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Action Items Checklist (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  {showTeamOverview ? "All Team Deliverables" : `${displayedUser}'s Assigned Action Items`}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {!showTeamOverview && (
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
                    <button
                      onClick={() => setTaskFilter("all")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        taskFilter === "all" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setTaskFilter("pending")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        taskFilter === "pending" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => setTaskFilter("completed")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        taskFilter === "completed" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Done
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsAddingTask(!isAddingTask)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Inline Add Task Drawer */}
            {isAddingTask && (
              <form
                onSubmit={handleCreateTask}
                className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Create Action Item</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Action item description (e.g. Deploy Slack webhook forwarder)..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Assignee
                    </label>
                    <select
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {participants.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Deadline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tomorrow 5:00 PM or Friday"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingTask || !newTaskText.trim()}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                  >
                    {isSubmittingTask ? "Saving..." : "Save Action Item"}
                  </button>
                </div>
              </form>
            )}

            {/* Task Checklist */}
            <div className="space-y-2.5">
              {showTeamOverview ? (
                /* Team Overview List */
                allTeamTasks.length === 0 ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
                    No tasks found across the team.
                  </div>
                ) : (
                  allTeamTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group bg-slate-900/50 hover:bg-slate-900/80 border rounded-xl p-3.5 flex items-start justify-between gap-3 transition-all ${
                        task.status === "completed"
                          ? "border-slate-800/50 opacity-60"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Toggle status"
                        >
                          {task.status === "completed" ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <div>
                          <p
                            className={`text-xs font-medium text-slate-200 ${
                              task.status === "completed" ? "line-through text-slate-500" : ""
                            }`}
                          >
                            {task.task}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700/60">
                              👤 {task.assignee || "Unassigned"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {task.deadline || "No deadline"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )
              ) : (
                /* Individual User Filtered List */
                loadingUser ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 animate-pulse">
                    Loading action items...
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
                    No {taskFilter !== "all" ? taskFilter : ""} action items assigned to {displayedUser}.
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group bg-slate-900/50 hover:bg-slate-900/90 border rounded-xl p-3.5 flex items-start justify-between gap-3 transition-all ${
                        task.status === "completed"
                          ? "border-slate-800/50 opacity-60 bg-slate-950/40"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                          title="Toggle completed"
                        >
                          {task.status === "completed" ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <div>
                          <p
                            className={`text-xs font-medium text-slate-200 leading-relaxed ${
                              task.status === "completed" ? "line-through text-slate-500" : ""
                            }`}
                          >
                            {task.task}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded font-medium ${
                                task.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              }`}
                            >
                              {task.status === "completed" ? "Completed" : "Pending"}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400 font-medium">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {task.deadline || "Unspecified"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          {/* Right Column: Personalized Briefing & Meeting Summary (1 Col) */}
          <div className="space-y-6">
            {/* What You Need to Know (Personalized) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Sync Digest for {displayedUser}
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {userData?.personalized_briefing ||
                  `In today's sync, key deliverables were aligned for ${displayedUser}. You have active action items requiring attention.`}
              </p>
            </div>

            {/* Team Meeting Notes / Executive Summary */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Latest Meeting Summary
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500">
                  {meetingSummary?.timestamp || "Today"}
                </span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed">
                {meetingSummary?.meeting_summary ||
                  "Meeting sync recorded. Tasks extracted and assigned across engineering workstreams with full local PII scrubbing."}
              </div>

              {meetingSummary?.key_topics && meetingSummary.key_topics.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Key Topics
                  </div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {meetingSummary.key_topics.map((topic, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Privacy Architecture Notice */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Leak Local Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All meeting audio & captions are sanitized on localhost using Microsoft Presidio.
                Your real identities are rehydrated in-browser so raw names never leave your device.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
