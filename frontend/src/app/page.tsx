"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
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
} from "lucide-react";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "http://localhost:8000";

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

export default function AegisMeetDashboard() {
  // State: Participants & Active User
  const [participants, setParticipants] = useState<string[]>(["Rohith", "Mayank", "Sambhav"]);
  const [selectedUser, setSelectedUser] = useState<string>("Rohith");

  // State: User Personalized Dashboard Data
  const [userData, setUserData] = useState<UserDashboardData | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");

  // State: All Team Tasks (for Team Overview)
  const [allTeamTasks, setAllTeamTasks] = useState<TaskItem[]>([]);
  const [showTeamOverview, setShowTeamOverview] = useState<boolean>(false);

  // State: Latest Meeting Recap
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);

  // State: Bot Controller
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

  // State: Add Task Form
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskText, setNewTaskText] = useState<string>("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("Rohith");
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>("Tomorrow at 5:00 PM");
  const [isSubmittingTask, setIsSubmittingTask] = useState<boolean>(false);

  // Fetch Participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/participants`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setParticipants(res.data);
        if (!res.data.includes(selectedUser)) {
          setSelectedUser(res.data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch participants:", e);
    }
  }, [selectedUser]);

  // Fetch User Dashboard Data
  const fetchUserDashboard = useCallback(async (user: string) => {
    setLoadingUser(true);
    try {
      const res = await axios.get(`${PROXY_URL}/api/user/${encodeURIComponent(user)}/dashboard`);
      setUserData(res.data);
    } catch (e) {
      console.error(`Failed to fetch dashboard for ${user}:`, e);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Fetch All Tasks & Meeting Summary
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
      // Backend might be restarting
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchParticipants();
    fetchGlobalData();
  }, [fetchParticipants, fetchGlobalData]);

  // When selectedUser changes
  useEffect(() => {
    fetchUserDashboard(selectedUser);
    setNewTaskAssignee(selectedUser);
  }, [selectedUser, fetchUserDashboard]);

  // Periodic polling for bot
  useEffect(() => {
    pollBotStatus();
    const interval = setInterval(() => {
      pollBotStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [pollBotStatus]);

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

    // Update in allTeamTasks
    setAllTeamTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus as "completed" | "pending" } : t))
    );

    // Call backend endpoint
    try {
      await axios.patch(`${PROXY_URL}/api/tasks/${task.id}`, { status: nextStatus });
    } catch (e) {
      console.error("Failed to update task status:", e);
      fetchUserDashboard(selectedUser);
    }
  };

  // Create New Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    setIsSubmittingTask(true);
    try {
      await axios.post(`${PROXY_URL}/api/tasks`, {
        task: newTaskText.trim(),
        assignee: newTaskAssignee.trim() || selectedUser,
        deadline: newTaskDeadline.trim() || "Tomorrow",
      });
      setNewTaskText("");
      setIsAddingTask(false);
      await Promise.all([fetchUserDashboard(selectedUser), fetchGlobalData(), fetchParticipants()]);
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
      await Promise.all([fetchUserDashboard(selectedUser), fetchGlobalData()]);
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
          fetchUserDashboard(selectedUser),
          fetchGlobalData(),
          fetchParticipants(),
          pollBotStatus(),
        ]);
        setIsLeaving(false);
        setBotMessage("Meeting finalized! Personalized action items and alerts updated.");
      }, 3000);
    } catch (e: any) {
      setIsLeaving(false);
      setBotMessage(e.response?.data?.detail || "Failed to leave meeting.");
    }
  };

  // Filter user tasks
  const filteredUserTasks = (userData?.tasks || []).filter((task) => {
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Zero-Leak Local Proxy
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Privacy-Preserving Meeting Intelligence & Personalized Workspaces
              </p>
            </div>
          </div>

          {/* Participant Portal Switcher */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center text-xs font-medium text-slate-400 gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Participant Portal:</span>
            </div>
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 shadow-inner">
              {participants.map((person) => {
                const isActive = selectedUser.toLowerCase() === person.toLowerCase();
                return (
                  <button
                    key={person}
                    onClick={() => {
                      setSelectedUser(person);
                      setShowTeamOverview(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isActive && !showTeamOverview
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-bold"
                        : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        isActive && !showTeamOverview
                          ? "bg-slate-950 text-emerald-400 font-black"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {person.charAt(0).toUpperCase()}
                    </span>
                    {person}
                  </button>
                );
              })}
              <button
                onClick={() => setShowTeamOverview(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  showTeamOverview
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
                }`}
                title="View All Team Tasks"
              >
                All Team
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                fetchUserDashboard(selectedUser);
                fetchGlobalData();
                fetchParticipants();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Real Google Meet Assistant Live Controller */}
        <section className="bg-gradient-to-r from-slate-900/90 via-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-slate-950/40">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Status & Context */}
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
                  <h2 className="text-sm font-semibold text-white">Google Meet Live Notetaker</h2>
                  {botStatus.active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      In Meeting ({botStatus.captions_captured} live caption chunks)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                      Assistant Ready
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {botStatus.active
                    ? `Connected to: ${botStatus.meet_url || "Active Call"} • Scrubbing PII on localhost before any reasoning.`
                    : "Join any live Google Meet link. Captures CC transcript, extracts personalized action items, and generates alerts."}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
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

          {/* Feedback message banner */}
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

        {/* Personalized Workspace Header / Banner */}
        {!showTeamOverview ? (
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
              {/* Profile Intro */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-emerald-500/20">
                  {selectedUser.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {selectedUser}&apos;s Workspace
                    </h1>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      Meeting Participant
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    {userData?.personalized_briefing ||
                      `Tailored updates, upcoming deliverables, and assigned action items from your team meetings.`}
                  </p>
                </div>
              </div>

              {/* KPI Stat Badges */}
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
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Team Cross-Functional Overview
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Consolidated view of all action items, assignees, and deadlines across the entire team.
                </p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Total Tasks: <span className="font-bold text-white">{allTeamTasks.length}</span>
              </div>
            </div>
          </section>
        )}

        {/* High-Priority Alerts Section (Only for Individual User View) */}
        {!showTeamOverview && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Personalized Alerts for {selectedUser}
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
                <span>All clear! No urgent alerts or overdue action items for {selectedUser}.</span>
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

                    {/* Quick Complete Action */}
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

        {/* Main Grid: Action Items & Meeting Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Action Items & Task Tracker (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  {showTeamOverview ? "All Team Action Items" : `${selectedUser}'s Assigned Action Items`}
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

                {/* Add Task Toggle Button */}
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

            {/* Task List */}
            <div className="space-y-2.5">
              {showTeamOverview ? (
                /* Team Overview List */
                allTeamTasks.length === 0 ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
                    No tasks found in system.
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
              ) : (
                /* Individual User Filtered List */
                loadingUser ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 animate-pulse">
                    Loading action items...
                  </div>
                ) : filteredUserTasks.length === 0 ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
                    No {taskFilter !== "all" ? taskFilter : ""} action items assigned to {selectedUser}.
                  </div>
                ) : (
                  filteredUserTasks.map((task) => (
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
                  Personalized Sync Briefing
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {userData?.personalized_briefing ||
                  `In today's sync, key deliverables were aligned for ${selectedUser}. You have active action items requiring attention.`}
              </p>
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Active Team Assignees
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {participants.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedUser(name);
                        setShowTeamOverview(false);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        selectedUser.toLowerCase() === name.toLowerCase() && !showTeamOverview
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                          : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                      }`}
                    >
                      👤 {name}
                    </button>
                  ))}
                </div>
              </div>
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
                  "Meeting sync recorded. Tasks extracted and assigned across engineering workstreams with full PII scrubbing."}
              </div>

              {meetingSummary?.key_topics && meetingSummary.key_topics.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Key Discussion Topics
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
                <span>Zero-Leak Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Meeting audio & transcripts are scrubbed on localhost using Presidio before any cloud reasoning.
                Personal identities are rehydrated in your browser so raw names never leave your machine.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
