"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  getCurrentUser,
  fetchTasks,
  fetchUsers,
  fetchProjects,
  createTask,
  api,
  AuthUser,
  TaskItem,
  ProjectItem,
} from "@/lib/api";
import { Plus, Trash2, CheckCircle2, Clock, X, AlertCircle, Shield, User, FolderLock } from "lucide-react";

export default function TasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [usersList, setUsersList] = useState<AuthUser[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | "all">("all");
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // New task modal
  const [showModal, setShowModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | undefined>(undefined);
  const [newTaskProjectId, setNewTaskProjectId] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [router]);

  const loadData = async (activeUser?: AuthUser | null) => {
    setIsLoading(true);
    try {
      const [tData, uData, pData] = await Promise.all([
        fetchTasks(),
        (activeUser?.role || user?.role) === "admin" ? fetchUsers() : Promise.resolve([]),
        fetchProjects().catch(() => []),
      ]);
      setTasks(tData || []);
      if (uData && uData.length > 0) {
        setUsersList(uData);
      }
      if (pData && pData.length > 0) {
        setProjects(pData);
        setNewTaskProjectId((prev) => (pData.some((p) => p.id === prev) ? prev : pData[0].id));
      }
    } catch {
      // quiet catch
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const assignee = user?.role === "admin" ? newTaskAssigneeId : user?.id;
      await createTask(newTaskTitle.trim(), newTaskDeadline.trim() || "unknown", assignee, newTaskProjectId);
      setNewTaskTitle("");
      setNewTaskDeadline("");
      setNewTaskAssigneeId(undefined);
      setShowModal(false);
      await loadData(user);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
      );
    } catch {
      alert("Failed to update status");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      alert("Failed to delete task");
    }
  };

  const filteredTasks = tasks.filter((t) => {
    // Project View State Isolation
    if (activeProjectId !== "all") {
      if (t.project_id !== activeProjectId) return false;
    }

    // Status filter
    if (filter === "completed" && t.status !== "completed") return false;
    if (filter === "pending" && t.status === "completed") return false;

    // Admin Assignee filter
    if (user?.role === "admin" && assigneeFilter !== "all") {
      if ((t.assignee || "").toLowerCase() !== assigneeFilter.toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Task Management</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
                {user?.role === "admin" ? "Enterprise Task Governance" : "My Assigned Tasks"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {user?.role === "admin"
                  ? "Admin visibility: inspect and manage deliverables across all company participants."
                  : `Strict privacy boundary: only tasks allocated to ${user?.canonical_name || "you"} are visible.`}
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>

          {/* Project Isolated View Tabs */}
          {projects.length > 0 && (
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderLock className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white tracking-wide uppercase">
                    Project Workspaces:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveProjectId("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      activeProjectId === "all"
                        ? "bg-white text-black shadow-xs"
                        : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
                    }`}
                  >
                    All Projects ({tasks.length})
                  </button>
                  {projects.map((p) => {
                    const isConfidential = p.id === 2 || p.name.includes("Confidential");
                    const count = tasks.filter((t) => t.project_id === p.id).length;
                    const isSelected = activeProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setNewTaskProjectId(p.id);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors border ${
                          isSelected
                            ? isConfidential
                              ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-xs"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-xs"
                            : "bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700"
                        }`}
                      >
                        {isConfidential ? <Shield className="w-3.5 h-3.5 text-red-400" /> : null}
                        <span>{p.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected ? "bg-white/20 text-white" : "bg-zinc-700 text-zinc-300"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confidential isolation banner when Project B is active */}
              {activeProjectId === 2 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-red-400">
                  <Shield className="w-4 h-4 text-red-400 shrink-0" />
                  <span>
                    Strict Confidential Mode: Displaying only isolated tasks for Project B. Unauthorized personnel have zero visibility into this partition.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Filter Pills & Admin Assignee Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  filter === "all"
                    ? "bg-black text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                All ({tasks.length})
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  filter === "pending"
                    ? "bg-black text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Pending ({tasks.filter((t) => t.status !== "completed").length})
              </button>
              <button
                onClick={() => setFilter("completed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  filter === "completed"
                    ? "bg-black text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Completed ({tasks.filter((t) => t.status === "completed").length})
              </button>
            </div>

            {user?.role === "admin" && usersList.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Assignee:</span>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-none focus:border-black"
                >
                  <option value="all">All Team Members</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.canonical_name || u.name}>
                      {u.canonical_name || u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tasks Table Dark Card */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-gray-400">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No tasks found for this view.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[11px] text-gray-400 font-medium pb-2">
                      <th className="pb-2.5 font-medium">Task</th>
                      <th className="pb-2.5 font-medium">Project</th>
                      {user?.role === "admin" && <th className="pb-2.5 font-medium">Assignee</th>}
                      <th className="pb-2.5 font-medium">Deadline</th>
                      <th className="pb-2.5 font-medium">Status</th>
                      <th className="pb-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="group hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 text-xs font-medium text-gray-200 group-hover:text-white">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className="cursor-pointer text-gray-400 hover:text-white"
                            >
                              {task.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-gray-500 hover:border-white"></div>
                              )}
                            </button>
                            <span
                              className={
                                task.status === "completed"
                                  ? "line-through text-gray-500"
                                  : "text-gray-200"
                              }
                            >
                              {task.task}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              task.project_id === 2 || (task.project_name || "").includes("Confidential")
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {task.project_name || (task.project_id === 2 ? "Project B (Confidential)" : "Project A (Main)")}
                          </span>
                        </td>
                        {user?.role === "admin" && (
                          <td className="py-3 text-xs text-zinc-300">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px]">
                              {task.assignee || "Unassigned"}
                            </span>
                          </td>
                        )}
                        <td className="py-3 text-xs text-gray-400">{task.deadline}</td>
                        <td className="py-3 text-xs">
                          {task.status === "completed" ? (
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-right">
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-gray-500 hover:text-red-400 p-1 rounded-md transition-colors cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Create Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900">Add New Task</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              {projects.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Project Workspace</span>
                    {newTaskProjectId === 2 && (
                      <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Confidential
                      </span>
                    )}
                  </label>
                  <select
                    value={newTaskProjectId}
                    onChange={(e) => setNewTaskProjectId(Number(e.target.value))}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black bg-white cursor-pointer"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} {proj.id === 2 ? "(Confidential)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Task Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement security audit logs"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                />
              </div>

              {user?.role === "admin" && usersList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={newTaskAssigneeId || ""}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black bg-white"
                  >
                    <option value="">Unassigned</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.canonical_name || u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Deadline
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15 Aug, tomorrow, or unknown"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
