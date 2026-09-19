"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  getCurrentUser,
  fetchMeetings,
  fetchBotStatus,
  fetchLatestResult,
  fetchProjects,
  joinMeeting,
  scheduleMeeting,
  leaveMeeting,
  api,
  AuthUser,
  MeetingItem,
  ProjectItem,
  BotStatus,
  MeetingSummary,
} from "@/lib/api";
import {
  Video,
  Calendar,
  Shield,
  Play,
  Clock,
  Sparkles,
  PhoneOff,
  Users,
  CheckCircle2,
  FileText,
  FolderLock,
} from "lucide-react";

export default function MeetingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(1);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [latestResult, setLatestResult] = useState<MeetingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [meetUrl, setMeetUrl] = useState("");
  const [meetingPurpose, setMeetingPurpose] = useState("Sprint Architecture Review");
  const [participants, setParticipants] = useState("Rohith, Mayank, Deepam, Admin");
  const [shareTechnical, setShareTechnical] = useState(true);
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual transcript test
  const [manualText, setManualText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadAll();

    const interval = setInterval(async () => {
      try {
        const [bStatus, lRes] = await Promise.all([
          fetchBotStatus(),
          fetchLatestResult(),
        ]);
        setBotStatus(bStatus);
        if (lRes) setLatestResult(lRes);
      } catch {
        // quiet poll
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [router]);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [mData, bStatus, lRes, pData] = await Promise.all([
        fetchMeetings().catch(() => []),
        fetchBotStatus().catch(() => null),
        fetchLatestResult().catch(() => null),
        fetchProjects().catch(() => []),
      ]);
      setMeetings(mData || []);
      setBotStatus(bStatus);
      setLatestResult(lRes);
      if (pData && pData.length > 0) {
        setProjects(pData);
        setSelectedProjectId((prev) => (pData.some((p) => p.id === prev) ? prev : pData[0].id));
      }
    } catch {
      // quiet catch
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const participantList = participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((name, idx) => ({ id: idx + 1, canonical_name: name, name }));

      if (scheduleTime) {
        await scheduleMeeting({
          meet_url: meetUrl.trim(),
          join_time: scheduleTime,
          expected_participants: participantList,
          share_technical_summary: shareTechnical,
          meeting_purpose: meetingPurpose,
          duration_sec: 180,
          project_id: selectedProjectId,
        });
        alert("Meeting scheduled with APScheduler successfully!");
      } else {
        await joinMeeting({
          meet_url: meetUrl.trim(),
          expected_participants: participantList,
          share_technical_summary: shareTechnical,
          meeting_purpose: meetingPurpose,
          duration_sec: 180,
          project_id: selectedProjectId,
        });
      }
      setMeetUrl("");
      setScheduleTime("");
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to trigger meeting bot");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualTranscript = async () => {
    if (!manualText.trim()) return;
    setIsSummarizing(true);
    try {
      const participantList = participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((name, idx) => ({ id: idx + 1, canonical_name: name, name }));

      const res = await api.post("/api/process", {
        transcript: manualText.trim(),
        meeting_title: meetingPurpose,
        participants: participantList,
        share_technical_summary: shareTechnical,
      });
      setLatestResult(res.data);
      setManualText("");
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to process transcript");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div>
            <p className="text-xs text-gray-500 font-medium">Meeting Intelligence</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
              Aegis Bot & Scheduled Sessions
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Air-gapped stealth bot execution with APScheduler and dynamic Presidio PII boundary.
            </p>
          </div>

          {/* Bot Status Banner */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    botStatus?.active
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      {botStatus?.active ? "Aegis Bot Active in Meeting" : "Aegis Bot Idle"}
                    </h3>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        botStatus?.active ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                      }`}
                    ></span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {botStatus?.active
                      ? `Target: ${botStatus.meet_url} | Captions: ${botStatus.captions_captured} | Duration: ${botStatus.duration_sec}s`
                      : "Ready to join Google Meet or schedule automated intake session."}
                  </p>
                </div>
              </div>

              {botStatus?.active && (
                <button
                  onClick={() => leaveMeeting().then(loadAll)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Disconnect Bot</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bot Launcher Form */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Launch or Schedule Meeting Bot</span>
              </h2>

              <form onSubmit={handleLaunchBot} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Google Meet URL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    value={meetUrl}
                    onChange={(e) => setMeetUrl(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center justify-between">
                    <span>Project Authorization & Isolation</span>
                    {projects.find((p) => p.id === selectedProjectId)?.name.includes("Confidential") && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 font-semibold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Strict Confidential
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Meeting transcript & action items are strictly isolated to authorized members of this project.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Meeting Purpose / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={meetingPurpose}
                    onChange={(e) => setMeetingPurpose(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Expected Participants (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Presidio dynamic deny-list targets these canonical names. Phonetic aliases (e.g. "Row hit") are normalized beforehand.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="shareTechCheck"
                    checked={shareTechnical}
                    onChange={(e) => setShareTechnical(e.target.checked)}
                    className="rounded border-zinc-700 text-white focus:ring-0"
                  />
                  <label htmlFor="shareTechCheck" className="text-xs text-gray-300 select-none">
                    Share technical summary with non-technical participants
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    APScheduler Join Time (Optional - leave empty for instant join)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !meetUrl}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                >
                  {scheduleTime ? (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? "Scheduling..." : "Schedule Meeting"}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>{isSubmitting ? "Launching Bot..." : "Launch Stealth Bot Now"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Live Privacy Simulation & Direct Ingestion */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Manual Transcript Ingestion & PII Test</span>
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Inject raw caption chunks directly into the pipeline to verify phonetic alias normalization, Presidio masking, and zero-hallucination extraction.
                </p>

                <textarea
                  rows={6}
                  placeholder="e.g. Row hit will optimize database indexing by next Monday. May ank to fix auth token leak."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleManualTranscript}
                  disabled={isSummarizing || !manualText}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSummarizing ? "Processing through Presidio & AI..." : "Process Transcript"}
                </button>
              </div>
            </div>
          </div>

          {/* Latest AI Summary Section */}
          {latestResult && (
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white" />
                  <h2 className="text-sm font-semibold text-white">
                    {latestResult.meeting_title || "Latest Meeting Intelligence Summary"}
                  </h2>
                </div>
                <span className="text-[11px] text-gray-400">{latestResult.timestamp}</span>
              </div>

              <div className="text-xs text-gray-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 whitespace-pre-wrap">
                {latestResult.meeting_summary || "No summary text generated."}
              </div>

              {latestResult.key_topics && latestResult.key_topics.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Key Topics Covered
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {latestResult.key_topics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs border border-zinc-700"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scheduled & Past Meetings List */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-white mb-4">Meetings History & Registry</h2>
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No meetings recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[11px] text-gray-400 font-medium pb-2">
                      <th className="pb-2.5 font-medium">Purpose</th>
                      <th className="pb-2.5 font-medium">Project</th>
                      <th className="pb-2.5 font-medium">Scheduled Time</th>
                      <th className="pb-2.5 font-medium">Privacy Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {meetings.map((m) => (
                      <tr key={m.id} className="group hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 text-xs font-medium text-gray-200 group-hover:text-white">
                          <Link
                            href={`/meetings/${m.id}`}
                            className="text-white hover:text-emerald-400 hover:underline transition-colors font-medium flex items-center gap-1.5"
                          >
                            <span>{m.purpose}</span>
                          </Link>
                        </td>
                        <td className="py-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              m.project_id === 2 || (m.project_name || "").includes("Confidential")
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {m.project_name || (m.project_id === 2 ? "Project B (Confidential)" : "Project A (Main)")}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-gray-400">{m.scheduled_time}</td>
                        <td className="py-3 text-xs">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Protected</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
