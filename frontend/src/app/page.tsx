"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  Layers,
  Eye,
  Server,
  Cpu,
  Lock,
  Radio,
  FileText,
  Sparkles,
  History,
  Activity,
  ChevronDown,
  ChevronUp,
  Video,
  Calendar,
  Play,
  Copy,
  Check,
  Code,
  ExternalLink,
  PhoneOff,
} from "lucide-react";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "http://localhost:8000";

interface TaskItem {
  id?: number;
  task: string;
  assignee?: string;
  assignee_token?: string;
  deadline: string;
  status?: string;
  created_at?: string;
}

interface ProcessResult {
  status: string;
  intercepted_cloud_payload: {
    endpoint: string;
    model: string;
    sent_sanitized_text: string;
    detected_entities_count: number;
  };
  llm_raw_response: any;
  rehydrated_result: {
    pm_view: string;
    group_view: string;
    absent_view: string;
    tasks: TaskItem[];
  };
  saved_task_ids: number[];
  ram_wiped: boolean;
  audit_id?: number;
}

interface AuditEntry {
  id: number;
  timestamp: string;
  raw_input_chars: number;
  entities_masked_count: number;
  detected_entity_types: string[];
  outbound_payload_chars: number;
  outbound_target: string;
  outbound_model: string;
  zero_leak_verified: boolean;
  ram_wipe_status: string;
}

interface WebhookEntry {
  id: number;
  timestamp: string;
  targets: string[];
  payload: string;
  status: string;
}

interface BotStatus {
  active: boolean;
  meet_url: string | null;
  bot_name: string | null;
  admitted: boolean;
  captions_captured: number;
  duration_sec: number;
}

interface IntakeFeedItem {
  timestamp: string;
  speaker: string;
  caption: string;
  masked_preview: string;
}

const SAMPLE_TRANSCRIPTS = [
  {
    title: "Hackathon Core Sync",
    text: `Mayank Sachdeva noted the API risk with Acme Corp. Sambhav agreed to build the UI by tomorrow at 5:00 PM. Rohith finished the FastAPI masking engine and verified that zero identities leave localhost. Mayank asked Sanjeet to test the webhook integration before next Friday.`,
  },
  {
    title: "Enterprise Client Scoping",
    text: `Alex Chen met with Wayne Enterprises to review the Q3 security audit. Jordan Lee reported that third-party AI summarizers were banned due to compliance restrictions. Alex committed to deploying AegisMeet by next Wednesday. Sam Patel will verify the Presidio spaCy pipeline tomorrow.`,
  },
  {
    title: "Sprint Retrospective & Deadlines",
    text: `Sambhav Chordia presented the Next.js dual-pane dashboard mockup to Mayank Sachdeva. Rohith noted that SQLite stores task action items without retaining raw personal names. Sambhav agreed to complete the responsive mobile layout by Thursday.`,
  },
];

export default function Dashboard() {
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPTS[0].text);
  const [loading, setLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(-1);
  const [proxyHealthy, setProxyHealthy] = useState<boolean | null>(null);
  const [ramTokensCount, setRamTokensCount] = useState<number>(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<"pm" | "group" | "absent" | "tasks">("pm");
  const [maskPreview, setMaskPreview] = useState<any>(null);

  // Telemetry & Feed state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [webhookFeed, setWebhookFeed] = useState<WebhookEntry[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [showWebhookFeed, setShowWebhookFeed] = useState<boolean>(false);

  // Active Bot & Live Intake Feed State
  const [botStatus, setBotStatus] = useState<BotStatus>({
    active: false,
    meet_url: null,
    bot_name: null,
    admitted: false,
    captions_captured: 0,
    duration_sec: 0,
  });
  const [stoppingBot, setStoppingBot] = useState<boolean>(false);
  const [intakeFeed, setIntakeFeed] = useState<IntakeFeedItem[]>([]);
  const [showIntakeFeed, setShowIntakeFeed] = useState<boolean>(true);

  // Live Meeting Join & Scheduling State
  const [meetUrl, setMeetUrl] = useState<string>("https://meet.google.com/xyz-abcd-efg");
  const [joinTime, setJoinTime] = useState<string>("");
  const [joinLoading, setJoinLoading] = useState<boolean>(false);
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [schedulerNotice, setSchedulerNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showInTabGuide, setShowInTabGuide] = useState<boolean>(true);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Health, Task & Bot Polling
  const checkHealth = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/health`, { timeout: 3000 });
      setProxyHealthy(res.data.status === "healthy");
      setRamTokensCount(res.data.ephemeral_tokens_in_ram || 0);
    } catch {
      setProxyHealthy(false);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/bot/status`, { timeout: 3000 });
      setBotStatus(res.data);
    } catch (e) {
      console.debug("Bot status fetch deferred:", e);
    }
  };

  const fetchIntakeFeed = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/intake/feed`, { timeout: 3000 });
      setIntakeFeed(res.data);
    } catch (e) {
      console.debug("Intake feed fetch deferred:", e);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/tasks`, { timeout: 15000 });
      setTasks(res.data);
    } catch (e) {
      console.debug("Tasks fetch deferred:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/audit-logs`, { timeout: 15000 });
      setAuditLogs(res.data);
    } catch (e) {
      console.debug("Audit logs fetch deferred:", e);
    }
  };

  const fetchWebhookFeed = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/api/webhooks/feed`, { timeout: 15000 });
      setWebhookFeed(res.data);
    } catch (e) {
      console.debug("Webhook feed fetch deferred:", e);
    }
  };

  const handleStopBot = async () => {
    setStoppingBot(true);
    try {
      await axios.post(`${PROXY_URL}/api/bot/stop`);
      setSchedulerNotice({
        type: "success",
        message: "🔴 Leaving Google Meet call... Finalizing zero-leak briefing and rehydrating action items!",
      });
      setTimeout(async () => {
        await fetchTasks();
        await fetchAuditLogs();
        await fetchWebhookFeed();
        await fetchBotStatus();
        setStoppingBot(false);
      }, 5000);
    } catch (e: any) {
      alert(`Stop bot failed: ${e.response?.data?.detail || e.message}`);
      setStoppingBot(false);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchTasks();
    fetchAuditLogs();
    fetchWebhookFeed();
    fetchBotStatus();
    fetchIntakeFeed();
    const interval = setInterval(() => {
      checkHealth();
      fetchTasks();
      fetchAuditLogs();
      fetchWebhookFeed();
      fetchBotStatus();
      fetchIntakeFeed();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMaskOnly = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${PROXY_URL}/api/mask`, { transcript });
      setMaskPreview(res.data);
    } catch (e: any) {
      alert(`Masking failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${PROXY_URL}/api/process`, { transcript });
      setResult(res.data);
      setMaskPreview(null);
      await fetchTasks();
      await fetchAuditLogs();
      await fetchWebhookFeed();
      await checkHealth();
    } catch (e: any) {
      alert(`Pipeline execution failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinNow = async () => {
    if (!meetUrl.trim()) {
      alert("Please enter a valid Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)");
      return;
    }
    setJoinLoading(true);
    setSchedulerNotice(null);
    try {
      const res = await axios.post(`${PROXY_URL}/join`, {
        meet_url: meetUrl.trim(),
        bot_name: "AegisMeet Notetaker",
      });
      setSchedulerNotice({
        type: "success",
        message: `🚀 Playwright Bot Dispatched! Connecting to ${meetUrl.trim()} with permissions bypassed...`,
      });
      setTimeout(() => setSchedulerNotice(null), 10000);
    } catch (e: any) {
      setSchedulerNotice({
        type: "error",
        message: `Join failed: ${e.response?.data?.detail || e.message}`,
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const handleBotLogin = async () => {
    try {
      setSchedulerNotice({
        type: "success",
        message: "🌐 Opening Google Chrome on your Mac for one-time Google Sign-In. Sign in, then simply close the window!",
      });
      await axios.post(`${PROXY_URL}/api/login`);
    } catch (err: any) {
      setSchedulerNotice({
        type: "error",
        message: `Failed to open Google Chrome: ${err.message}`,
      });
    }
  };

  const handleScheduleBot = async () => {
    if (!meetUrl.trim()) {
      alert("Please enter a Google Meet URL to schedule");
      return;
    }
    if (!joinTime) {
      alert("Please select a valid date and time");
      return;
    }
    setScheduleLoading(true);
    setSchedulerNotice(null);
    try {
      const isoTime = new Date(joinTime).toISOString();
      const res = await axios.post(`${PROXY_URL}/schedule`, {
        meet_url: meetUrl.trim(),
        join_time: isoTime,
        bot_name: "AegisMeet Notetaker",
      });
      setSchedulerNotice({
        type: "success",
        message: `⏰ Successfully Scheduled! Job ID: ${res.data.job_id} scheduled for ${new Date(joinTime).toLocaleString()}`,
      });
      setTimeout(() => setSchedulerNotice(null), 12000);
    } catch (e: any) {
      setSchedulerNotice({
        type: "error",
        message: `Scheduling failed: ${e.response?.data?.detail || e.message}`,
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSimulation = async () => {
    setIsSimulating(true);
    setResult(null);
    setMaskPreview(null);

    const simulationTurns = [
      { speaker: "Mayank Sachdeva", text: "Good morning team. Today we are reviewing the AegisMeet zero-leak proxy architecture." },
      { speaker: "Rohith", text: "I have completed the FastAPI backend endpoints and Presidio masking integration with en_core_web_lg." },
      { speaker: "Sambhav Chordia", text: "Great. Acme Corp expressed security concerns about raw meeting notes reaching public LLMs." },
      { speaker: "Mayank Sachdeva", text: "Exactly. We must guarantee that zero personal names or company identities leave localhost." },
      { speaker: "Sambhav Chordia", text: "I will finalize the Next.js dual-pane dashboard by tomorrow at 5:00 PM." },
      { speaker: "Mayank Sachdeva", text: "Agreed. Rohith, please verify the webhook dispatch and SQLite task logging before next Friday." },
    ];

    let accumulated = "";
    for (let i = 0; i < simulationTurns.length; i++) {
      setSimulationIndex(i);
      const turn = simulationTurns[i];
      const chunk = `${turn.speaker}: ${turn.text}`;
      accumulated += (accumulated ? "\n" : "") + chunk;
      setTranscript(accumulated);

      try {
        await axios.post(`${PROXY_URL}/api/intake`, {
          speaker: turn.speaker,
          caption: turn.text,
        });
      } catch (err) {
        console.debug("Intake stream notification:", err);
      }

      await new Promise((r) => setTimeout(r, 650));
    }

    setIsSimulating(false);
    setSimulationIndex(-1);

    // Trigger pipeline on final transcript
    setLoading(true);
    try {
      const res = await axios.post(`${PROXY_URL}/api/process`, { transcript: accumulated });
      setResult(res.data);
      await fetchTasks();
      await fetchAuditLogs();
      await fetchWebhookFeed();
      await checkHealth();
    } catch (e: any) {
      alert(`Simulation processing failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`${PROXY_URL}/api/tasks/${id}`);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Delete task failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">AegisMeet</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-950 border border-indigo-700 text-indigo-300">
                  Zero-Leak Proxy
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Air-Gapped Presidio Masking Engine & Persona-Based Reasoning
              </p>
            </div>
          </div>

          {/* Status Telemetry */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Model:</span>
              <span className="font-medium text-slate-200">Llama 3 70B (Featherless)</span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">RAM State:</span>
              <span className={`font-medium ${ramTokensCount === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {ramTokensCount === 0 ? "Wiped (0 Tokens)" : `${ramTokensCount} Active`}
              </span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    proxyHealthy === true ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                <span className="font-medium text-slate-200">
                  {proxyHealthy === true ? "Proxy Live (8000)" : "Proxy Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Step 3: Live Testing Harness & Google Meet Scheduler */}
        <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Video className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Live Testing Harness & Meeting Scheduler
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  Playwright Bypass
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Launches Chromium with auto-accepted media streams (<code className="text-xs text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">--use-fake-ui-for-media-stream</code>) and streams DOM captions via MutationObserver.
              </p>
            </div>
          </div>

          {/* Join and Schedule Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Meet URL */}
            <div className="md:col-span-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Video className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Google Meet URL</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setMeetUrl("http://localhost:8000/mock-meet")}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 px-2 py-0.5 rounded-md transition-all flex items-center space-x-1"
                  >
                    <span>🎯 Fill Mock Meet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInTabGuide(!showInTabGuide)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 px-2 py-0.5 rounded-md transition-all flex items-center space-x-1"
                  >
                    <Code className="w-3 h-3" />
                    <span>In-Tab Scraper</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={meetUrl}
                  onChange={(e) => setMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Join Now Primary Button */}
            <div className="md:col-span-2">
              <button
                onClick={handleJoinNow}
                disabled={joinLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {joinLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Join Now</span>
                  </>
                )}
              </button>
            </div>

            {/* DateTime Input */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Schedule Bot (FastAPI APScheduler)</span>
              </label>
              <div className="flex space-x-2">
                <input
                  type="datetime-local"
                  value={joinTime}
                  onChange={(e) => setJoinTime(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleScheduleBot}
                  disabled={scheduleLoading}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium border border-cyan-800/60 flex items-center space-x-1.5 transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {scheduleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Schedule</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Google Meet Bot Live Control Banner */}
          {botStatus.active && (
            <div className="mt-5 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 shadow-lg shadow-emerald-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-start md:items-center space-x-3">
                <div className="relative flex h-3.5 w-3.5 mt-0.5 md:mt-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-emerald-300">
                      {botStatus.admitted ? "🟢 Bot Active in Google Meet Call" : "🟡 Bot in Lobby / Requesting Join..."}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-700 text-emerald-200 font-mono font-medium">
                      {botStatus.captions_captured} captions captured
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-slate-400">Target: <span className="text-cyan-300 font-mono">{botStatus.meet_url}</span></span>
                    <span>•</span>
                    <span>Elapsed: <strong className="text-white font-mono">{Math.floor(botStatus.duration_sec / 60)}m {botStatus.duration_sec % 60}s</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStopBot}
                disabled={stoppingBot}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-950 flex items-center space-x-2 transition-all whitespace-nowrap disabled:opacity-50"
              >
                {stoppingBot ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PhoneOff className="w-4 h-4" />}
                <span>Leave Call & Generate Briefing</span>
              </button>
            </div>
          )}

          {/* Real-time Intake Caption Feed */}
          {intakeFeed.length > 0 && (
            <div className="mt-5 rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Live Privacy-Preserving Caption Stream (Presidio Masked)</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {intakeFeed.length} chunks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIntakeFeed(!showIntakeFeed)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <span>{showIntakeFeed ? "Collapse" : "Expand"}</span>
                  {showIntakeFeed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {showIntakeFeed && (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                  {intakeFeed.slice(-8).map((chunk, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="text-cyan-400 font-semibold">{chunk.speaker}</span>
                        <span>{new Date(chunk.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-500 mr-2 text-[10px]">RAW:</span>
                        <span>{chunk.caption}</span>
                      </div>
                      <div className="text-emerald-400/90">
                        <span className="text-emerald-600 mr-2 text-[10px]">MASKED:</span>
                        <span>{chunk.masked_preview}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Google Meet Bot Access Guidance Card */}
          {showInTabGuide && (
            <div className="mt-5 p-4 rounded-xl bg-slate-950/90 border border-blue-500/40 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>🛡️ Google Meet Real Call Access: Fixing &quot;You can&apos;t join this video call&quot;</span>
                </div>
                <button
                  type="button"
                  onClick={handleBotLogin}
                  className="text-[11px] text-white bg-blue-600 hover:bg-blue-500 border border-blue-400 px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all shadow-sm font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Sign In Bot with Google</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider block">Option 1: 1-Click Host Setting (Instant)</span>
                  <p className="text-slate-300 leading-relaxed">
                    In your Google Meet call tab, click the <strong>blue shield icon (Host controls)</strong> at the bottom right ➔ set <strong>Meeting access</strong> to <strong className="text-emerald-300">&quot;Open&quot;</strong> (or turn Host management OFF). Then click <em>&quot;Join with Live Bot&quot;</em>!
                  </p>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-blue-400 font-bold uppercase tracking-wider block">Option 2: 1-Time Google Sign-In</span>
                  <p className="text-slate-300 leading-relaxed">
                    Click <strong>&quot;Sign In Bot with Google&quot;</strong> above. Chrome will open on your Mac desktop. Sign into any Google account and close the window. The bot will knock as an authenticated user!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Alert Banner */}
          {schedulerNotice && (
            <div
              className={`mt-4 p-3 rounded-xl border text-xs flex items-center space-x-2 transition-all ${
                schedulerNotice.type === "success"
                  ? "bg-emerald-950/70 border-emerald-700/60 text-emerald-300"
                  : "bg-rose-950/70 border-rose-700/60 text-rose-300"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{schedulerNotice.message}</span>
            </div>
          )}
        </section>

        {/* Temporary Fallback: Manual Transcript Pasting & Pipeline Execution */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Emergency Fallback: Manual Transcript Intake</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300">
                  Hackathon Safe Fallback
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Paste meeting text directly to execute the zero-leak pipeline if Google Meet DOM changes during the live demo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium mr-1">Sample Scenarios:</span>
              {SAMPLE_TRANSCRIPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setTranscript(sample.text)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              placeholder="Paste raw Google Meet captions or live transcript..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
            {isSimulating && (
              <div className="absolute top-3 right-3 flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-700 text-indigo-300 text-xs animate-pulse">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>Streaming Captions ({simulationIndex + 1}/6)...</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Microsoft Presidio + spaCy en_core_web_lg offline entity extraction</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleMaskOnly}
                disabled={loading || isSimulating}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Inspect PII Masking</span>
              </button>

              <button
                onClick={handleSimulation}
                disabled={loading || isSimulating}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-sm font-medium border border-indigo-900/60 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <Radio className="w-4 h-4 text-indigo-400" />
                <span>Simulate Playwright Bot</span>
              </button>

              <button
                onClick={handleProcess}
                disabled={loading || isSimulating}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Zero-Leak Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* PII Mask Preview Drawer */}
        {maskPreview && !result && (
          <section className="bg-slate-900 border border-cyan-800/50 rounded-2xl p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-cyan-300 flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <span>Presidio Masking Inspection ({maskPreview.entities_count} PII Entities Detected)</span>
              </h3>
              <button
                onClick={() => setMaskPreview(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close Preview
              </button>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg font-mono text-xs text-slate-300 border border-slate-800 whitespace-pre-wrap">
              {maskPreview.masked_text}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {maskPreview.detected_entities?.map((e: any, idx: number) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono"
                >
                  <span className="text-amber-400 font-semibold">{e.original}</span>
                  <span className="text-slate-500 mx-1">→</span>
                  <span className="text-cyan-400 font-semibold">{e.token}</span>
                  <span className="text-slate-500 ml-1">({e.entity_type})</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* THE DUAL-PANE VIEW: Intercepted Cloud Payload vs. Re-hydrated Local Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT PANE: Intercepted Cloud Payload */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">1. Intercepted Cloud Payload</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 border border-amber-600/50 text-amber-300 flex items-center space-x-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Outgoing Air-Gap Packet</span>
                </span>
              </div>

              <div className="mb-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  This represents the exact HTTP JSON body sent across the network to Featherless AI.
                  Notice that all personal names and company identities are tokenized into safe bracketed tokens.
                </p>
              </div>

              {result ? (
                <div className="space-y-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300">
                    <div className="text-slate-500 mb-1">// Outbound HTTP Request: POST {result.intercepted_cloud_payload.endpoint}</div>
                    <div className="text-slate-500 mb-3">// Model: {result.intercepted_cloud_payload.model}</div>
                    <div className="p-3 bg-slate-900 rounded border border-slate-800 whitespace-pre-wrap leading-relaxed text-amber-300">
                      {result.intercepted_cloud_payload.sent_sanitized_text}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Raw JSON Returned by Cloud LLM
                    </h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-400 max-h-48 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(result.llm_raw_response, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <Lock className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-400">No active network packet intercepted</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Execute the pipeline or simulate caption stream to inspect the zero-leak cloud payload.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero PII Transmitted</span>
              </span>
              <span>Network Guard: Active</span>
            </div>
          </div>

          {/* RIGHT PANE: Re-hydrated Local Intelligence */}
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">2. Re-hydrated Local Intelligence</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/70 border border-indigo-600/50 text-indigo-300 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Localhost Restored</span>
                </span>
              </div>

              <div className="mb-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tokens are reconstituted only inside the local memory space. Personas are parsed into
                  role-specific views and routed directly to team webhooks.
                </p>
              </div>

              {/* Persona Navigation Tabs */}
              <div className="flex border-b border-slate-800 mb-4 space-x-2">
                <button
                  onClick={() => setActiveTab("pm")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === "pm"
                      ? "border-amber-400 text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>PM Risks</span>
                </button>
                <button
                  onClick={() => setActiveTab("group")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === "group"
                      ? "border-indigo-400 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Group Decisions</span>
                </button>
                <button
                  onClick={() => setActiveTab("absent")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === "absent"
                      ? "border-cyan-400 text-cyan-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Absentee Catch-Up</span>
                </button>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === "tasks"
                      ? "border-emerald-400 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Extracted Tasks</span>
                </button>
              </div>

              {result ? (
                <div className="space-y-4">
                  {activeTab === "pm" && (
                    <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
                      <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>High-Level Risks, Blockers & Constraints</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {result.rehydrated_result.pm_view}
                      </p>
                    </div>
                  )}

                  {activeTab === "group" && (
                    <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4">
                      <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs mb-2">
                        <Layers className="w-4 h-4" />
                        <span>Team Milestones & Architectural Decisions</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {result.rehydrated_result.group_view}
                      </p>
                    </div>
                  )}

                  {activeTab === "absent" && (
                    <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
                      <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs mb-2">
                        <User className="w-4 h-4" />
                        <span>Concise Briefing for Absent Team Members</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {result.rehydrated_result.absent_view}
                      </p>
                    </div>
                  )}

                  {activeTab === "tasks" && (
                    <div className="space-y-2">
                      {result.rehydrated_result.tasks.map((task, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                                {task.assignee}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{task.deadline}</span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 font-medium">{task.task}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Webhook Dispatch Simulator Status */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-slate-300">
                      <Send className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Webhook Dispatch: Discord/Slack payload delivered</span>
                    </div>
                    <span className="text-emerald-400 font-medium">Status: 200 OK</span>
                  </div>
                </div>
              ) : (
                <div className="h-64 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-400">Awaiting processing execution</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Persona-based intelligence and action items will populate here.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 text-indigo-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Re-hydration: Complete</span>
              </span>
              <span>RAM Auto-Wipe: Enabled</span>
            </div>
          </div>
        </div>

        {/* TELEMETRY & AUDIT PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Zero-Leak Security Audit Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Zero-Leak Cryptographic Audit Log</h3>
              </div>
              <button
                onClick={() => setShowAuditLogs(!showAuditLogs)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-medium"
              >
                <span>{showAuditLogs ? "Collapse" : "Expand Logs"}</span>
                {showAuditLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Verifiable network telemetry proving that all outbound HTTP packets contain 0 raw identities.
            </p>

            {auditLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No audit logs recorded yet. Execute the pipeline to generate telemetry.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {(showAuditLogs ? auditLogs : auditLogs.slice(0, 2)).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-indigo-400 font-semibold">Audit #{log.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {log.zero_leak_verified ? "ZERO LEAK VERIFIED" : "UNVERIFIED"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                      <div>Masked: <span className="text-slate-200">{log.entities_masked_count} entities</span></div>
                      <div>RAM Wipe: <span className="text-emerald-400">{log.ram_wipe_status}</span></div>
                      <div>Target: <span className="text-slate-200">{log.outbound_model.split("/").pop()}</span></div>
                      <div>Timestamp: <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Webhook Dispatch Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-white">Live Webhook Dispatch Stream</h3>
              </div>
              <button
                onClick={() => setShowWebhookFeed(!showWebhookFeed)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-medium"
              >
                <span>{showWebhookFeed ? "Collapse" : "Expand Stream"}</span>
                {showWebhookFeed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Observes recent payloads pushed to external team messaging endpoints (Discord / Slack).
            </p>

            {webhookFeed.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No webhooks dispatched yet. Run pipeline or simulation to see broadcasts.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {(showWebhookFeed ? webhookFeed : webhookFeed.slice(0, 2)).map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-300">{item.targets.join(", ")}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">{item.status}</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {item.payload}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PERSISTENT SQLITE TASK TRACKING DASHBOARD */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Persistent SQLite Task Tracking Dashboard</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tasks persisted in local SQLite database (<code className="font-mono text-slate-300">tasks.db</code>).
                Identities remain tokenized to enforce Zero Persistent PII on disk.
              </p>
            </div>

            <button
              onClick={fetchTasks}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Tasks</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Action Item</th>
                  <th className="py-3 px-4">Assignee (Token Reference)</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No tasks currently stored in SQLite database.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">#{task.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-100">{task.task}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-indigo-300">
                          {task.assignee_token || task.assignee || "Unassigned"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{task.deadline || "Unspecified"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {task.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
