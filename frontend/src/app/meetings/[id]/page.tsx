"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  getCurrentUser,
  fetchMeetingById,
  endMeetingBatch,
  updateTaskStatus,
  AuthUser,
  SingleMeetingResponse,
  TaskItem,
} from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  CheckSquare,
  RefreshCw,
  AlertTriangle,
  Play,
} from "lucide-react";

interface MeetingDetailProps {
  params: Promise<{ id: string }>;
}

export default function MeetingDetailPage({ params }: MeetingDetailProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const meetingId = resolvedParams.id;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [meeting, setMeeting] = useState<SingleMeetingResponse | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<"pm" | "group" | "absent">("group");
  const [isLoading, setIsLoading] = useState(true);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadMeeting();
  }, [meetingId, router]);

  const loadMeeting = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchMeetingById(meetingId);
      setMeeting(data);
      setTasks(data.tasks || []);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || "Failed to load meeting details or access restricted."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndMeetingBatch = async () => {
    setIsEndingMeeting(true);
    try {
      await endMeetingBatch({
        meeting_id: meetingId,
        meeting_purpose: meeting?.purpose,
        expected_participants: meeting?.config?.expected_participants,
        share_technical_summary: meeting?.config?.share_technical_summary,
      });
      await loadMeeting();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to finalize meeting buffer");
    } finally {
      setIsEndingMeeting(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await updateTaskStatus(taskId, nextStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
    } catch {
      alert("Failed to update task status");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/meetings"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-200/60"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Meetings</span>
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-xs font-medium text-gray-700">
                Meeting #{meetingId}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadMeeting}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              {meeting && (
                <button
                  onClick={handleEndMeetingBatch}
                  disabled={isEndingMeeting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-gray-800 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {isEndingMeeting
                      ? "Running Batch AI Reasoning..."
                      : "End Meeting & Batch Process"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {errorMsg ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
              <h3 className="text-sm font-semibold text-red-500">Meeting Access Denied</h3>
              <p className="text-xs text-red-400">{errorMsg}</p>
              <Link
                href="/meetings"
                className="inline-block mt-3 text-xs font-semibold text-red-600 hover:underline"
              >
                Return to Meetings Registry
              </Link>
            </div>
          ) : isLoading ? (
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-12 text-center text-xs text-gray-400 shadow-xs">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
              <span>Fetching meeting intelligence records...</span>
            </div>
          ) : !meeting ? (
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-12 text-center text-xs text-gray-400 shadow-xs">
              Meeting record not found.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Meeting Header Banner */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {meeting.status === "completed" ? "Completed" : "Active / Scheduled"}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Zero-Leak Air-Gapped Session
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      {meeting.purpose}
                    </h1>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <span>{meeting.scheduled_time || "Scheduled"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Shield className="w-4 h-4" />
                      <span>Air-Gap Masked</span>
                    </div>
                  </div>
                </div>

                {/* View Selection Tabs: PM View | Group View | Absentee View */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setActiveViewTab("group")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeViewTab === "group"
                        ? "bg-white text-black shadow-xs"
                        : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                    }`}
                  >
                    Group View (Core Decisions)
                  </button>

                  <button
                    onClick={() => setActiveViewTab("pm")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeViewTab === "pm"
                        ? "bg-white text-black shadow-xs"
                        : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                    }`}
                  >
                    PM View (Risks & Blockers)
                  </button>

                  <button
                    onClick={() => setActiveViewTab("absent")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeViewTab === "absent"
                        ? "bg-white text-black shadow-xs"
                        : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                    }`}
                  >
                    Absentee View (Catch-Up)
                  </button>
                </div>

                {/* Tab Content Display */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-300 leading-relaxed min-h-[120px]">
                  {activeViewTab === "group" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Core Decisions & Team Deliverables</span>
                      </div>
                      <div className="text-zinc-100 text-sm whitespace-pre-wrap leading-relaxed font-normal">
                        {meeting.group_view ||
                          "No group view generated yet. If the meeting has ended, trigger 'End Meeting & Batch Process' above."}
                      </div>
                    </div>
                  )}

                  {activeViewTab === "pm" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>PM Risks, Blockers & Resource Dependencies</span>
                      </div>
                      <div className="text-zinc-100 text-sm whitespace-pre-wrap leading-relaxed font-normal">
                        {meeting.pm_view ||
                          "No PM view generated yet. End-of-meeting batch analysis will extract operational risks and dependencies."}
                      </div>
                    </div>
                  )}

                  {activeViewTab === "absent" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Absentee Catch-Up Summary</span>
                      </div>
                      <div className="text-zinc-100 text-sm whitespace-pre-wrap leading-relaxed font-normal">
                        {meeting.absent_view ||
                          "No absentee summary available. Once generated, team members who missed the call will see key takeaways here."}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Items & Tasks Table */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-white" />
                    <h2 className="text-sm font-semibold text-white">
                      Extracted Action Items ({tasks.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Strict Anti-Hallucination Verified
                  </span>
                </div>

                {tasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    No action items linked to this meeting yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 font-medium">
                          <th className="pb-2.5 w-10">Done</th>
                          <th className="pb-2.5 font-medium">Task Description</th>
                          <th className="pb-2.5 font-medium">Assignee</th>
                          <th className="pb-2.5 font-medium">Deadline</th>
                          <th className="pb-2.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {tasks.map((task) => {
                          const isDone = task.status === "completed";
                          const isUnknownDeadline =
                            !task.deadline ||
                            task.deadline.toLowerCase() === "unknown" ||
                            task.deadline.toLowerCase() === "unspecified";

                          return (
                            <tr
                              key={task.id}
                              className="group hover:bg-zinc-800/30 transition-colors"
                            >
                              <td className="py-3">
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => handleToggleTask(task.id, task.status)}
                                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-black focus:ring-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`text-xs font-medium transition-colors ${
                                    isDone
                                      ? "line-through text-zinc-500"
                                      : "text-zinc-200 group-hover:text-white"
                                  }`}
                                >
                                  {task.task}
                                </span>
                              </td>
                              <td className="py-3 text-xs text-zinc-300">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  <span>{task.assignee || "Unassigned"}</span>
                                </span>
                              </td>
                              <td className="py-3 text-xs">
                                {isUnknownDeadline ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    unknown
                                  </span>
                                ) : (
                                  <span className="text-zinc-300">{task.deadline}</span>
                                )}
                              </td>
                              <td className="py-3 text-xs">
                                <span
                                  className={`flex items-center gap-1.5 font-medium ${
                                    isDone ? "text-emerald-400" : "text-amber-400"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isDone ? "bg-emerald-400" : "bg-amber-400"
                                    }`}
                                  ></span>
                                  <span>{isDone ? "Completed" : "Pending"}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
