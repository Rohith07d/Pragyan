"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getCurrentUser, AuthUser, fetchMessages, sendChatMessage, clearChatMessages } from "@/lib/api";
import {
  Mail,
  Send,
  Hash,
  User,
  Shield,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  Paperclip,
  Smile,
  MoreVertical,
  CheckCheck,
  Trash2,
} from "lucide-react";

interface Message {
  id: string;
  sender: string;
  senderRole?: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
  isBot?: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: "channel" | "dm";
  unread: number;
  role?: string;
  initialMessages: Message[];
}

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: "general",
    name: "general",
    type: "channel",
    unread: 0,
    initialMessages: [],
  },
  {
    id: "meeting-briefs",
    name: "meeting-briefs",
    type: "channel",
    unread: 0,
    initialMessages: [],
  },
  {
    id: "engineering",
    name: "engineering-zero-leak",
    type: "channel",
    unread: 0,
    initialMessages: [],
  },
  {
    id: "dm-mayank",
    name: "Mayank Sachdeva",
    type: "dm",
    unread: 0,
    role: "Tech Lead",
    initialMessages: [],
  },
  {
    id: "dm-sambhav",
    name: "Sambhav Chordia",
    type: "dm",
    unread: 0,
    role: "Frontend Specialist",
    initialMessages: [],
  },
  {
    id: "dm-aegisbot",
    name: "AegisBot Assistant",
    type: "dm",
    unread: 0,
    role: "Air-Gapped AI Assistant",
    initialMessages: [],
  },
];

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>("meeting-briefs");
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider at bottom if within 80px of bottom
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  const handleClearHistory = async () => {
    try {
      await clearChatMessages(activeChannelId);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId ? { ...c, initialMessages: [], unread: 0 } : c
        )
      );
      isAtBottomRef.current = true;
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  const markChannelAsRead = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId && c.unread > 0 ? { ...c, unread: 0 } : c))
    );
  };

  const handleMarkAllRead = () => {
    setChannels((prev) =>
      prev.map((c) => (c.unread > 0 ? { ...c, unread: 0 } : c))
    );
  };

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    markChannelAsRead(channelId);
  };

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    // Read saved channel unread map if available
    try {
      const savedMap = localStorage.getItem("aegis_channel_unread_map");
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        setChannels((prev) =>
          prev.map((c) => ({
            ...c,
            unread: c.id === activeChannelId ? 0 : (parsed[c.id] ?? c.unread),
          }))
        );
        return;
      }
    } catch {}

    // First load: Mark initially opened channel as read
    markChannelAsRead(activeChannelId);
  }, []);

  // Synchronize unread counts to localStorage and broadcast event safely outside render phase
  useEffect(() => {
    let isMounted = true;
    const total = channels.reduce((sum, c) => sum + c.unread, 0);
    const unreadMap = channels.reduce((acc, c) => ({ ...acc, [c.id]: c.unread }), {});
    try {
      localStorage.setItem("aegis_unread_messages_count", String(total));
      localStorage.setItem("aegis_channel_unread_map", JSON.stringify(unreadMap));
    } catch {}
    const timer = setTimeout(() => {
      if (isMounted) {
        window.dispatchEvent(new CustomEvent("aegis_messages_updated", { detail: { unread: total } }));
      }
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [channels]);

  // Poll backend for fresh channel messages every 3 seconds so other deployed users' messages appear live
  useEffect(() => {
    let isMounted = true;

    async function syncChannelMessages() {
      try {
        const serverMsgs = await fetchMessages(activeChannelId);
        if (!isMounted) return;

        const mapped: Message[] = (serverMsgs || []).map((sm) => {
          const senderLower = (sm.sender_name || "").toLowerCase();
          const userLower = (currentUser?.canonical_name || currentUser?.name || "").toLowerCase();
          const isSelf = userLower ? senderLower === userLower : false;
          return {
            id: String(sm.id),
            sender: sm.sender_name,
            senderRole: sm.sender_role || undefined,
            text: sm.text,
            timestamp: sm.created_at,
            isSelf,
            isBot: sm.sender_name === "AegisBot",
          };
        });

        setChannels((prev) =>
          prev.map((c) => {
            if (c.id !== activeChannelId) return c;
            // Prevent re-rendering and auto-scroll if message list has not changed!
            const isIdentical =
              c.initialMessages.length === mapped.length &&
              c.initialMessages.every(
                (m, idx) => m.id === mapped[idx].id && m.text === mapped[idx].text
              );
            if (isIdentical) return c;
            return { ...c, initialMessages: mapped };
          })
        );
      } catch {
        // quiet fallback
      }
    }

    syncChannelMessages();
    const interval = setInterval(syncChannelMessages, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeChannelId, currentUser]);

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || channels[0];

  // Scroll to bottom on channel switch
  useEffect(() => {
    isAtBottomRef.current = true;
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);
  }, [activeChannelId]);

  // Only scroll down when new messages arrive IF user was already at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChannel.initialMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const currentText = messageText.trim();
    setMessageText("");

    const senderName = currentUser?.canonical_name || currentUser?.name || "Team Member";
    const senderRole = currentUser?.role === "admin" ? "Admin" : "Team Member";

    // Optimistic local UI update
    const optimisticMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: senderName,
      senderRole: senderRole,
      text: currentText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSelf: true,
    };

    setChannels((prev) =>
      prev.map((c) =>
        c.id === activeChannelId
          ? { ...c, initialMessages: [...c.initialMessages, optimisticMsg] }
          : c
      )
    );

    isAtBottomRef.current = true;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    try {
      // Persist directly to backend SQLite so all other users on deployed frontends see it!
      const res = await sendChatMessage({
        channel_id: activeChannelId,
        text: currentText,
        sender_name: senderName,
        sender_role: senderRole,
      });

      if (res?.bot_reply) {
        const botReply: Message = {
          id: `bot_${res.bot_reply.id}`,
          sender: "AegisBot",
          senderRole: "Air-Gapped AI Assistant",
          text: res.bot_reply.text,
          timestamp: res.bot_reply.created_at,
          isSelf: false,
          isBot: true,
        };
        setChannels((prev) =>
          prev.map((c) =>
            c.id === activeChannelId
              ? { ...c, initialMessages: [...c.initialMessages, botReply] }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Failed to send message to backend:", err);
    }
  };

  const filteredMessages = activeChannel.initialMessages.filter((m) =>
    searchQuery
      ? m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const totalUnread = channels.reduce((acc, c) => acc + c.unread, 0);

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] font-sans antialiased text-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Enterprise Communications</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-2.5 flex-wrap">
                <span>Team Messages & Briefs</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black text-white">
                  {totalUnread > 0 ? `${totalUnread} New` : "All Caught Up"}
                </span>
                {totalUnread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-gray-700 hover:text-black font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer shadow-2xs"
                    title="Mark all messages as read across all channels"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mark all as read</span>
                  </button>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Air-Gapped End-to-End Privacy</span>
            </div>
          </div>

          {/* Interactive Chat Console Container */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl shadow-xs flex flex-col md:flex-row flex-1 overflow-hidden min-h-[640px]">
            {/* Left Channel & DM List */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col bg-zinc-950/60 select-none">
              <div className="p-4 border-b border-zinc-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search channel messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Team Channels */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">
                    Channels
                  </div>
                  <div className="space-y-1">
                    {channels
                      .filter((c) => c.type === "channel")
                      .map((c) => {
                        const isActive = c.id === activeChannelId;
                        return (
                          <button
                            key={c.id}
                            onClick={() => handleSelectChannel(c.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              isActive
                                ? "bg-zinc-800 text-white font-semibold"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Hash className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                              <span className="truncate">{c.name}</span>
                            </div>
                            {c.unread > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-700 text-white">
                                {c.unread}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Direct Messages */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">
                    Direct Messages
                  </div>
                  <div className="space-y-1">
                    {channels
                      .filter((c) => c.type === "dm")
                      .map((c) => {
                        const isActive = c.id === activeChannelId;
                        const isAegis = c.id === "dm-aegisbot";
                        return (
                          <button
                            key={c.id}
                            onClick={() => handleSelectChannel(c.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              isActive
                                ? "bg-zinc-800 text-white font-semibold"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isAegis ? (
                                <div className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                                  <Bot className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                  {c.name.charAt(0)}
                                </div>
                              )}
                              <div className="text-left truncate">
                                <span className="truncate block">{c.name}</span>
                              </div>
                            </div>
                            {c.unread > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-700 text-white">
                                {c.unread}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Chat Stream Viewport */}
            <div className="flex-1 flex flex-col bg-[#18181b]">
              {/* Channel Header */}
              <div className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {activeChannel.type === "channel" ? (
                    <Hash className="w-4 h-4 text-zinc-400" />
                  ) : activeChannel.id === "dm-aegisbot" ? (
                    <Bot className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-white flex items-center justify-center text-xs font-bold">
                      {activeChannel.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{activeChannel.name}</span>
                      {activeChannel.role && (
                        <span className="text-[10px] font-normal text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {activeChannel.role}
                        </span>
                      )}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    title="Clear messages in this channel"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700/60 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Chat</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-[11px]">Connected</span>
                  </div>
                </div>
              </div>

              {/* Message Stream */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {filteredMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                    <Mail className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                    <p className="text-xs">No messages matching your filter.</p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 text-xs leading-relaxed ${
                        msg.isSelf ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!msg.isSelf && (
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            msg.isBot
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                          }`}
                        >
                          {msg.isBot ? <Bot className="w-4 h-4" /> : msg.sender.charAt(0)}
                        </div>
                      )}

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 space-y-1 ${
                          msg.isSelf
                            ? "bg-white text-black"
                            : msg.isBot
                            ? "bg-emerald-950/30 border border-emerald-800/40 text-emerald-200"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={`font-semibold ${
                              msg.isSelf
                                ? "text-gray-900"
                                : msg.isBot
                                ? "text-emerald-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {msg.isSelf ? "You" : msg.sender}
                            {msg.senderRole && !msg.isSelf && (
                              <span className="ml-1 opacity-70">({msg.senderRole})</span>
                            )}
                          </span>
                          <span
                            className={
                              msg.isSelf
                                ? "text-gray-500"
                                : msg.isBot
                                ? "text-emerald-500"
                                : "text-zinc-500"
                            }
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message #${activeChannel.name}... (Press Enter to send)`}
                    className="flex-1 text-xs px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="p-3 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4 fill-black" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
