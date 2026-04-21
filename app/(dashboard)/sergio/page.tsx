"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Wrench,
} from "lucide-react";
import {
  createSergioConversation,
  fetchSergioConversations,
  fetchSergioMessages,
  sendSergioMessage,
  type SergioConversation,
  type SergioMessage,
} from "@/lib/api/sergio";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";

type PendingConfirm = {
  title: string;
  body: string;
};

function formatRelativeDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function SergioPage() {
  const [conversations, setConversations] = useState<SergioConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SergioMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConvId) ?? null,
    [conversations, currentConvId]
  );

  const filteredConversations = useMemo(() => {
    const q = cmdSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, cmdSearch]);

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  async function reloadConversations(selectLast = false) {
    const rows = await fetchSergioConversations();
    setConversations(rows);
    if (rows.length === 0) {
      const created = await createSergioConversation();
      setConversations([created]);
      setCurrentConvId(created.id);
      return;
    }
    if (!currentConvId || !rows.some((c) => c.id === currentConvId)) {
      setCurrentConvId(rows[0].id);
      return;
    }
    if (selectLast) setCurrentConvId(rows[0].id);
  }

  async function handleNewConversation() {
    const created = await createSergioConversation();
    setConversations((prev) => [created, ...prev]);
    setCurrentConvId(created.id);
    setMessages([]);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        const initials =
          `${(me.name ?? "").trim()[0] ?? ""}${(me.surname ?? "").trim()[0] ?? ""}`.toUpperCase();
        if (!cancel) setUserInitials(initials || "U");
      } catch {
        if (!cancel) setUserInitials("U");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    void reloadConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentConvId) return;
    let cancel = false;
    (async () => {
      const rows = await fetchSergioMessages(currentConvId);
      if (!cancel) setMessages(rows);
      scrollBottom();
    })();
    return () => {
      cancel = true;
    };
  }, [currentConvId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSend(overrideText?: string) {
    if (!currentConvId || loading) return;
    const text = (overrideText ?? input).trim();
    if (!text && !attachedFile) return;

    const optimisticUser: SergioMessage = {
      id: Date.now(),
      role: "user",
      content: text || "Analyze attachment",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    const file = attachedFile;
    setAttachedFile(null);
    setLoading(true);
    setPendingConfirm(null);
    scrollBottom();

    try {
      const imageBase64 = file ? await fileToBase64(file) : undefined;
      const response = await sendSergioMessage(
        currentConvId,
        text || "Analyze attachment",
        imageBase64
      );
      const assistant: SergioMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.reply,
        tool_calls: response.toolCalls,
        tool_results: response.toolResults,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistant]);
      const needsConfirm =
        Array.isArray(response.toolResults) &&
        response.toolResults.some((r) =>
          String((r.result as { error?: string })?.error ?? "")
            .toLowerCase()
            .includes("confirmation required")
        );
      if (needsConfirm) {
        setPendingConfirm({
          title: "Confirmation required",
          body: "Sergio prepared a write/export action. Confirm to proceed or cancel.",
        });
      }
      await reloadConversations();
      scrollBottom();
    } catch (err) {
      const failed: SergioMessage = {
        id: Date.now() + 2,
        role: "assistant",
        content:
          err instanceof Error
            ? `Error: ${err.message}`
            : "Error: failed to get Sergio response.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, failed]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-9rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-[#1e1e1e] bg-[#0f0f0f]">
      <div className="flex items-center justify-between border-b border-[#1e1e1e] px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFA00] text-sm font-bold text-black">
            S
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#e5e5e5]">
              {currentConversation?.title ?? "Sergio"}
            </div>
            <div className="text-[10px] text-[#555]">
              claude-sonnet-4 · PITCH AI assistant
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#4ade80]/20 bg-[#1a2e1a] px-2 py-0.5 text-[10px] text-[#4ade80]">
            Events
          </span>
          <span className="rounded-full border border-[#4ade80]/20 bg-[#1a2e1a] px-2 py-0.5 text-[10px] text-[#4ade80]">
            Assignments
          </span>
          <span className="rounded-full border border-[#f87171]/20 bg-[#2e1a1a] px-2 py-0.5 text-[10px] text-[#f87171]">
            No financial data
          </span>
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#141414] px-2 py-1 text-[10px] text-[#444] hover:border-[#555] hover:text-[#888]"
          >
            <kbd className="font-mono">⌘K</kbd> history
          </button>
          <button
            onClick={() => void handleNewConversation()}
            className="rounded-lg border border-[#FFFA00]/30 px-2 py-1 text-[10px] text-[#FFFA00] hover:bg-[#FFFA00]/10"
          >
            + New
          </button>
        </div>
      </div>

      {cmdOpen && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 pt-20"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-[360px] overflow-hidden rounded-xl border border-[#333] bg-[#111]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[#1e1e1e] px-3 py-2.5">
              <Search size={13} className="text-[#555]" />
              <input
                autoFocus
                value={cmdSearch}
                onChange={(e) => setCmdSearch(e.target.value)}
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-[12px] text-[#ccc] outline-none placeholder:text-[#333]"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto py-1">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setCurrentConvId(conv.id);
                    setCmdOpen(false);
                  }}
                  className="mx-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[11px] text-[#888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]"
                >
                  <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <span className="text-[9px] text-[#444]">
                    {formatRelativeDate(conv.updated_at)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 border-t border-[#1e1e1e] px-3 py-2 text-[10px] text-[#333]">
              <span>
                <kbd className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1">
                  ↑↓
                </kbd>{" "}
                navigate
              </span>
              <span>
                <kbd className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1">
                  ↵
                </kbd>{" "}
                open
              </span>
              <span>
                <kbd className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1">
                  esc
                </kbd>{" "}
                close
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map((m) => {
          const user = m.role === "user";
          return (
            <div
              key={`${m.id}-${m.created_at}`}
              className={`mb-4 flex ${user ? "justify-end" : "justify-start"}`}
            >
              <div className="flex max-w-[78%] gap-2">
                {!user ? (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FFFA00] text-[11px] font-bold text-black">
                    S
                  </div>
                ) : null}
                <div
                  className={`rounded-xl border px-3 py-2 text-[13px] ${
                    user
                      ? "rounded-tr-sm border-[#4ade80]/30 bg-[#1a2a1a] text-[#d1fadf]"
                      : "rounded-tl-sm border-[#2a2a2a] bg-[#141414] text-[#d9d9d9]"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {!user &&
                  Array.isArray(m.tool_calls) &&
                  Array.isArray(m.tool_results) &&
                  m.tool_calls.length > 0
                    ? (m.tool_calls as Array<{ name?: string }>).map((tool, i) => (
                        <div
                          key={`${tool.name ?? "tool"}-${i}`}
                          className="mt-2 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3"
                        >
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#FFFA00]">
                            <Wrench size={12} />
                            {tool.name ?? "tool"}
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-[#888]">
                            {JSON.stringify((m.tool_results as unknown[])[i] ?? {}, null, 2)}
                          </pre>
                        </div>
                      ))
                    : null}
                  {!user && pendingConfirm && iAmLastAssistant(messages, m) ? (
                    <div className="mt-2 rounded-lg border border-[#FFFA00] bg-[#0d0d0d] p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#FFFA00]">
                        <AlertTriangle size={13} />
                        {pendingConfirm.title}
                      </div>
                      <p className="mb-3 text-[12px] text-[#aaa]">{pendingConfirm.body}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleSend("Confirmed, proceed.")}
                          className="rounded-lg bg-[#FFFA00] px-3 py-1.5 text-[12px] font-medium text-black"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => void handleSend("Cancel, do not proceed.")}
                          className="rounded-lg border border-[#333] px-3 py-1.5 text-[12px] text-[#888]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {user ? (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[11px] font-bold text-[#4ade80]">
                    {userInitials}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {loading ? (
          <div className="mb-4 flex justify-start">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FFFA00] text-[11px] font-bold text-black">
              S
            </div>
            <div className="ml-2 rounded-xl rounded-tl-sm border border-[#2a2a2a] bg-[#141414]">
              <div className="flex gap-1 p-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#444]"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#1e1e1e] p-4">
        <div className="flex items-end gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] p-2.5 focus-within:border-[#FFFA00]">
          <label className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] text-[#555] hover:border-[#555] hover:text-[#aaa]">
            <Paperclip size={14} />
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setAttachedFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {attachedFile ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#818cf8]/30 bg-[#1a1a2e] px-2 py-1 text-[11px] text-[#818cf8]">
              <FileText size={11} />
              <span className="max-w-[120px] truncate">{attachedFile.name}</span>
              <button
                onClick={() => setAttachedFile(null)}
                className="text-[#555] hover:text-[#f87171]"
              >
                ×
              </button>
            </div>
          ) : null}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask Sergio something…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] text-[#e5e5e5] outline-none placeholder:text-[#333]"
          />
          <button
            onClick={() => void handleSend()}
            disabled={(!input.trim() && !attachedFile) || loading}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFFA00] disabled:opacity-30"
          >
            <Send size={14} className="text-black" />
          </button>
        </div>
        <div className="mt-2 text-center text-[10px] text-[#333]">
          Sergio can read events, assignments, accreditations and shifts — never
          financial or personal data
        </div>
      </div>
    </div>
  );
}

function iAmLastAssistant(messages: SergioMessage[], message: SergioMessage): boolean {
  const idx = messages.findIndex((m) => m.id === message.id);
  if (idx < 0) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].id === message.id;
  }
  return false;
}
