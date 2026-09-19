"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  getCurrentUser,
  fetchProjects,
  fetchTasks,
  api,
  AuthUser,
  ProjectItem,
  TaskItem,
} from "@/lib/api";
import { Folder, Plus, CheckCircle2, Clock, X } from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New project modal
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadData();
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pData, tData] = await Promise.all([
        fetchProjects().catch(() => []),
        fetchTasks().catch(() => []),
      ]);
      setProjects(pData || []);
      setTasks(tData || []);
    } catch {
      // quiet catch
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.post("/api/projects", { name: projectName.trim() });
      setProjects((prev) => [...prev, res.data]);
      setProjectName("");
      setShowModal(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Merge default demo projects if none exist
  const displayProjects =
    projects.length > 0
      ? projects
      : [
          { id: 1, name: "Workspace App" },
          { id: 2, name: "Auth System" },
          { id: 3, name: "UI Kit" },
          { id: 4, name: "Project A" },
        ];

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Enterprise Management</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
                Active Projects
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Overview of ongoing initiatives and milestone distributions.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayProjects.map((p) => {
              const projectTasks = tasks.filter(
                (t) => t.project_id === p.id || (t.project_name || "").toLowerCase() === p.name.toLowerCase()
              );
              const pendingCount = projectTasks.filter((t) => t.status !== "completed").length;
              const completedCount = projectTasks.filter((t) => t.status === "completed").length;
              const isConfidential = p.id === 2 || p.name.includes("Confidential");

              return (
                <div
                  key={p.id}
                  className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                          isConfidential ? "bg-red-950 border border-red-800/60 text-red-300" : "bg-zinc-800"
                        }`}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {p.name}
                            {isConfidential && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                Confidential
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] text-gray-400">ID: #{p.id}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <div className="mt-6 space-y-2">
                      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Linked Tasks ({projectTasks.length})</span>
                        <span className="text-[10px] text-zinc-500 lowercase">
                          {pendingCount} pending • {completedCount} done
                        </span>
                      </div>
                      {projectTasks.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No tasks currently assigned to this project.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {projectTasks.slice(0, 4).map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-zinc-900/60 text-zinc-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  t.status === "completed" ? "bg-emerald-400" : "bg-amber-400"
                                }`}></span>
                                <span className="truncate">{t.task}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{t.deadline}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {pendingCount > 0 ? `${pendingCount} pending task${pendingCount > 1 ? "s" : ""}` : "All tasks completed"}
                    </span>
                    <button
                      onClick={() => router.push(`/tasks?project_id=${p.id}`)}
                      className="text-white hover:underline text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>Manage tasks</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900">Create Project</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile Client Redesign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
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
                  {isSubmitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
