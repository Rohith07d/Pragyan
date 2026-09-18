import axios from "axios";

export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: PROXY_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: Attach JWT Bearer token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("aegis_auth_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: Handle 401s by clearing session and redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      // Clear token and user session on authentication failure
      localStorage.removeItem("aegis_auth_token");
      localStorage.removeItem("aegis_auth_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface AuthUser {
  id: number;
  canonical_name: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

export interface TaskItem {
  id: number;
  meeting_id?: number;
  assignee_id?: number;
  task: string;
  assignee?: string;
  assignee_token?: string;
  deadline: string;
  status: "completed" | "pending" | "in_progress";
  created_at?: string;
  project_name?: string;
}

export interface MeetingItem {
  id: number;
  purpose: string;
  scheduled_time: string;
  config_flags?: any;
}

export interface ProjectItem {
  id: number;
  name: string;
}

export interface BotStatus {
  active: boolean;
  meet_url: string | null;
  bot_name: string | null;
  admitted: boolean;
  captions_captured: number;
  duration_sec: number;
}

export interface MeetingSummary {
  meeting_id?: number;
  meeting_title?: string;
  timestamp?: string;
  meeting_summary?: string;
  key_topics?: string[];
  share_technical_summary?: boolean;
}

// Auth APIs
export async function loginUser(identifier: string, password: string):Promise<{ token: string; user: AuthUser }> {
  const res = await api.post("/login", {
    canonical_name: identifier.trim(),
    password: password.trim(),
  });
  const data = res.data;
  const token = data.access_token || data.token;
  const rawUser = data.user;
  const resolvedName = rawUser.canonical_name || rawUser.name || "User";
  const user: AuthUser = {
    id: rawUser.id,
    canonical_name: resolvedName,
    name: resolvedName,
    email: rawUser.email || `${resolvedName.toLowerCase().replace(/\s+/g, ".")}@aegismeet.internal`,
    role: rawUser.role || "user",
  };

  if (typeof window !== "undefined") {
    localStorage.setItem("aegis_auth_token", token);
    localStorage.setItem("aegis_auth_user", JSON.stringify(user));
  }
  return { token, user };
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("aegis_auth_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const resolvedName = parsed.canonical_name || parsed.name || "User";
    return {
      id: parsed.id,
      canonical_name: resolvedName,
      name: resolvedName,
      email: parsed.email || `${resolvedName.toLowerCase().replace(/\s+/g, ".")}@aegismeet.internal`,
      role: parsed.role || "user",
    };
  } catch {
    return null;
  }
}

export function logoutUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("aegis_auth_token");
    localStorage.removeItem("aegis_auth_user");
    window.location.href = "/login";
  }
}

// Data APIs
export async function fetchTasks(userOnly: boolean = true): Promise<TaskItem[]> {
  const res = await api.get("/api/tasks");
  return res.data || [];
}

export async function updateTaskStatus(taskId: number, status: "completed" | "pending"): Promise<any> {
  const res = await api.patch(`/api/tasks/${taskId}`, { status });
  return res.data;
}

export async function createTask(task: string, deadline: string = "unknown", assigneeId?: number): Promise<any> {
  const res = await api.post("/api/tasks", {
    task,
    deadline,
    assignee_id: assigneeId,
    status: "pending",
  });
  return res.data;
}

export async function fetchMeetings(): Promise<MeetingItem[]> {
  const res = await api.get("/api/meetings");
  return res.data || [];
}

export async function fetchProjects(): Promise<ProjectItem[]> {
  const res = await api.get("/api/projects");
  return res.data || [];
}

export async function fetchLatestResult(): Promise<MeetingSummary | null> {
  try {
    const res = await api.get("/api/latest-result");
    return res.data || null;
  } catch {
    return null;
  }
}

export async function fetchBotStatus(): Promise<BotStatus> {
  try {
    const res = await api.get("/api/bot/status");
    return res.data;
  } catch {
    return {
      active: false,
      meet_url: null,
      bot_name: null,
      admitted: false,
      captions_captured: 0,
      duration_sec: 0,
    };
  }
}

export async function joinMeeting(payload: {
  meet_url: string;
  expected_participants?: any[];
  share_technical_summary?: boolean;
  meeting_purpose?: string;
  bot_name?: string;
  duration_sec?: number;
}): Promise<any> {
  const res = await api.post("/join", payload);
  return res.data;
}

export async function scheduleMeeting(payload: {
  meet_url: string;
  join_time: string;
  expected_participants?: any[];
  share_technical_summary?: boolean;
  meeting_purpose?: string;
  bot_name?: string;
  duration_sec?: number;
}): Promise<any> {
  const res = await api.post("/schedule", payload);
  return res.data;
}

export async function leaveMeeting(): Promise<any> {
  const res = await api.post("/api/bot/leave");
  return res.data;
}
