"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  createCookiesJarTask,
  fetchCookiesJarTasks,
  updateCookiesJarTask,
  type CookiesJarTask,
} from "@/lib/api/cookiesJarTasks";
import {
  createDocument,
  fetchDocuments,
  updateDocument,
  type Document as PitchDocument,
} from "@/lib/api/documents";
import { apiFetch } from "@/lib/api/apiFetch";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { fetchStaff, type StaffItem } from "@/lib/api/staff";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";

function staffFullName(s: StaffItem): string {
  return `${s.surname} ${s.name}`.trim();
}

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ON_HOLD" | "";

type TaskFormValues = {
  title: string;
  assigneeId: number | "";
  team: string;
  project: string;
  startDate: string;
  status: Exclude<TaskStatus, "">;
};

const PRIMARY_BTN_SM =
  "min-h-[44px] rounded bg-pitch-accent px-4 py-2 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const FILTER_SELECT_CLASS =
  "rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

const INPUT_SM_CLASS =
  "min-w-[120px] rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1.5 text-xs text-pitch-white placeholder:text-pitch-gray focus:border-pitch-accent focus:outline-none";

const TEAM_OPTIONS = [
  "RESOURCES",
  "MEDIA",
  "RIGHTS",
  "CREATIVE",
  "OPERATION",
  "OTHER",
] as const;

const DOC_CATEGORY_LABEL: Record<PitchDocument["category"], string> = {
  REGULATION: "Regulation",
  TECH_SPEC: "Technical spec",
  INTERNAL_PROCEDURE: "Internal procedure",
  OTHER: "Other",
};

type DocumentFormValues = {
  title: string;
  category: PitchDocument["category"];
  competition: string;
  validFrom: string;
  validTo: string;
  tagsText: string;
  filePath: string;
};

type ChatMessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  tasks?: CookiesJarTask[];
  documents?: PitchDocument[];
};

function formatIsoDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const s = String(iso);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function fileBasename(path: string): string {
  const s = path.replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

function truncateFileLabel(path: string, max = 36): string {
  const base = fileBasename(path);
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1)}…`;
}

function createdAtShort(iso: string): string {
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 16);
}

function validityRange(doc: PitchDocument): string {
  if (!doc.valid_from && !doc.valid_to) return "—";
  const a = doc.valid_from ? formatIsoDateOnly(doc.valid_from) : "—";
  const b = doc.valid_to ? formatIsoDateOnly(doc.valid_to) : "—";
  return `${a} → ${b}`;
}

function statusBadge(status: CookiesJarTask["status"]) {
  switch (status) {
    case "TODO":
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          TODO
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-200">
          In progress
        </span>
      );
    case "DONE":
      return (
        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
          Done
        </span>
      );
    case "ON_HOLD":
      return (
        <span className="rounded-full bg-orange-900/40 px-2 py-0.5 text-xs text-orange-200">
          On hold
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray">
          {status}
        </span>
      );
  }
}

type CookiesJarTasksPageProps = {
  initialDate: string;
  initialTasks: CookiesJarTask[];
  initialDocuments: PitchDocument[];
};

export function CookiesJarTasksPage({
  initialDate,
  initialTasks,
  initialDocuments,
}: CookiesJarTasksPageProps) {
  const { loading: permissionsLoading, levelByPageKey } =
    usePagePermissions();
  const canEditCookiesJar =
    !permissionsLoading && levelByPageKey.cookies_jar === "edit";

  const [staffNameById, setStaffNameById] = useState<Map<number, string>>(
    () => new Map()
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await fetchStaff({ limit: 100, offset: 0 });
        if (cancelled) return;
        setStaffNameById((prev) => {
          const m = new Map(prev);
          for (const s of items) {
            const fn = staffFullName(s);
            if (!m.has(s.id)) m.set(s.id, fn);
          }
          return m;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [debouncedAssigneeSearch, setDebouncedAssigneeSearch] =
    useState("");
  const [assigneeHits, setAssigneeHits] = useState<StaffItem[]>([]);
  const [assigneeSearchLoading, setAssigneeSearchLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedAssigneeSearch(assigneeSearch.trim()),
      300
    );
    return () => window.clearTimeout(t);
  }, [assigneeSearch]);

  useEffect(() => {
    if (!debouncedAssigneeSearch) {
      setAssigneeHits([]);
      setAssigneeSearchLoading(false);
      return;
    }
    let cancelled = false;
    setAssigneeSearchLoading(true);
    void fetchStaff({ q: debouncedAssigneeSearch, limit: 20 })
      .then(({ items }) => {
        if (cancelled) return;
        setAssigneeHits(items);
        setStaffNameById((prev) => {
          const m = new Map(prev);
          for (const s of items) {
            m.set(s.id, staffFullName(s));
          }
          return m;
        });
      })
      .catch(() => {
        if (!cancelled) setAssigneeHits([]);
      })
      .finally(() => {
        if (!cancelled) setAssigneeSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedAssigneeSearch]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("");
  const [tasks, setTasks] = useState<CookiesJarTask[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CookiesJarTask | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [taskFormValues, setTaskFormValues] = useState<TaskFormValues>({
    title: "",
    assigneeId: "",
    team: "",
    project: "",
    startDate: initialDate,
    status: "TODO",
  });

  const projectSuggestions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.project && t.project.trim()) {
        set.add(t.project.trim());
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const order: Record<CookiesJarTask["status"], number> = {
      TODO: 0,
      IN_PROGRESS: 1,
      ON_HOLD: 2,
      DONE: 3,
    };
    return [...tasks].sort((a, b) => {
      const oa = order[a.status];
      const ob = order[b.status];
      if (oa !== ob) return oa - ob;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [tasks]);

  const teamFormSelectOptions = useMemo(() => {
    const v = taskFormValues.team.trim();
    const base = [...TEAM_OPTIONS];
    if (v && !(TEAM_OPTIONS as readonly string[]).includes(v)) {
      return [v, ...base];
    }
    return base;
  }, [taskFormValues.team]);

  const [documents, setDocuments] = useState<PitchDocument[]>(initialDocuments);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docCompetitionFilter, setDocCompetitionFilter] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState<
    PitchDocument["category"] | ""
  >("");
  const [docTagFilter, setDocTagFilter] = useState("");
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PitchDocument | null>(null);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docFormValues, setDocFormValues] = useState<DocumentFormValues>({
    title: "",
    category: "REGULATION",
    competition: "",
    validFrom: "",
    validTo: "",
    tagsText: "",
    filePath: "",
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const reloadDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const items = await fetchDocuments({
        competition: docCompetitionFilter.trim() || undefined,
        category: docCategoryFilter || undefined,
        tag: docTagFilter.trim() || undefined,
      });
      setDocuments(items);
    } catch (err) {
      setDocsError(
        err instanceof Error
          ? err.message
          : "Error loading documents."
      );
    } finally {
      setDocsLoading(false);
    }
  }, [docCompetitionFilter, docCategoryFilter, docTagFilter]);

  useEffect(() => {
    void reloadDocuments();
  }, [reloadDocuments]);

  const reloadTasks = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const items = await fetchCookiesJarTasks({
          date: selectedDate,
          team: teamFilter.trim() || undefined,
          status: statusFilter || undefined,
        });
        setTasks(items);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error loading tasks."
        );
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [selectedDate, teamFilter, statusFilter]
  );

  useEffect(() => {
    void reloadTasks();
  }, [reloadTasks]);

  const handleSubmitTask = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = taskFormValues.title.trim();
    if (!title) {
      setFormError("Task description is required.");
      return;
    }
    if (!taskFormValues.startDate) {
      setFormError("Start date is required.");
      return;
    }

    let assigneeForApi: number | null | undefined;
    if (taskFormValues.assigneeId === "") {
      assigneeForApi = editingTask ? null : undefined;
    } else {
      const n = Number(taskFormValues.assigneeId);
      if (!Number.isFinite(n) || n < 1) {
        setFormError("Invalid assignee.");
        return;
      }
      assigneeForApi = n;
    }

    const teamTrim = taskFormValues.team.trim();
    const projectTrim = taskFormValues.project.trim();

    setSaving(true);
    try {
      if (editingTask) {
        await updateCookiesJarTask(editingTask.id, {
          title,
          assigneeId: assigneeForApi,
          team: teamTrim || undefined,
          project: projectTrim || undefined,
          startDate: taskFormValues.startDate,
          status: taskFormValues.status,
        });
      } else {
        await createCookiesJarTask({
          title,
          assigneeId:
            assigneeForApi === null ? undefined : assigneeForApi,
          team: teamTrim || undefined,
          project: projectTrim || undefined,
          startDate: taskFormValues.startDate,
          status: taskFormValues.status,
        });
      }
      await reloadTasks({ silent: true });
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Error saving task."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDocument = async (e: FormEvent) => {
    e.preventDefault();
    setDocFormError(null);

    const title = docFormValues.title.trim();
    const category = docFormValues.category;
    const competition = docFormValues.competition.trim();
    const filePath = docFormValues.filePath.trim();

    if (!title || !category || !filePath) {
      setDocFormError("Title, category, and file path are required.");
      return;
    }

    const validFrom = docFormValues.validFrom.trim() || undefined;
    const validTo = docFormValues.validTo.trim() || undefined;
    const tags = docFormValues.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSavingDoc(true);
    try {
      if (editingDoc) {
        const updated = await updateDocument(editingDoc.id, {
          title,
          category,
          competition: competition || undefined,
          validFrom,
          validTo,
          tags,
          filePath,
        });
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
      } else {
        const created = await createDocument({
          title,
          category,
          competition: competition || undefined,
          validFrom,
          validTo,
          tags,
          filePath,
        });
        setDocuments((prev) => [created, ...prev]);
      }
      setIsDocModalOpen(false);
      setEditingDoc(null);
    } catch (err) {
      setDocFormError(
        err instanceof Error
          ? err.message
          : "Error saving document."
      );
    } finally {
      setSavingDoc(false);
    }
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    setChatError(null);
    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: text,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    const messagesPayload = [
      ...chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    try {
      const res = await apiFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesPayload,
          context: {
            page: "cookies-jar",
            date: selectedDate,
            teamFilter: teamFilter || null,
            statusFilter: statusFilter || null,
          },
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Agent error: ${res.status}`);
      }

      const data = (await res.json()) as {
        reply?: unknown;
        tasks?: unknown[];
        documents?: unknown[];
      };

      const replyText =
        typeof data.reply === "string"
          ? data.reply
          : data.reply != null
            ? String(data.reply)
            : "";

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content:
          replyText.trim() !== ""
            ? replyText
            : "(Nessun testo nella risposta.)",
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks as CookiesJarTask[]);
      }
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Error calling agent."
      );
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={FILTER_SELECT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-pitch-gray">Team</label>
          <select
            className={INPUT_SM_CLASS}
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">All</option>
            {TEAM_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">Status</label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TaskStatus)
            }
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="ON_HOLD">ON_HOLD</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      ) : null}

      {canEditCookiesJar ? (
        <div className="mb-3 flex justify-end">
          <PrimaryButton
            type="button"
            variant="primary"
            onClick={() => {
              setEditingTask(null);
              setFormError(null);
              setTaskFormValues({
                title: "",
                assigneeId: "",
                team: teamFilter.trim(),
                project: "",
                startDate: selectedDate,
                status: "TODO",
              });
              setAssigneeSearch("");
              setAssigneeHits([]);
              setDebouncedAssigneeSearch("");
              setIsModalOpen(true);
            }}
          >
            New task
          </PrimaryButton>
        </div>
      ) : null}

      <ResponsiveTable
        className="rounded-lg border border-pitch-gray-dark"
        minWidth="960px"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Assigned to
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Team
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Project
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Start date
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                End date
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-0 align-top">
                  <EmptyState message="Nessun task presente" icon="list" />
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/20 ${
                    task.status === "DONE"
                      ? "bg-gray-50 text-gray-400"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-pitch-white">
                    {task.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {task.assignee_id != null
                      ? staffNameById.get(task.assignee_id) ??
                        `#${task.assignee_id}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {task.team || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {task.project || "—"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(task.status)}</td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {formatIsoDateOnly(task.start_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {task.status === "DONE"
                      ? formatIsoDateOnly(task.completed_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {canEditCookiesJar ? (
                      <button
                        type="button"
                        className="text-xs text-pitch-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingTask(task);
                          setFormError(null);
                          setTaskFormValues({
                            title: task.title,
                            assigneeId:
                              task.assignee_id != null ? task.assignee_id : "",
                            team: task.team ?? "",
                            project: task.project ?? "",
                            startDate: formatIsoDateOnly(task.start_date),
                            status: task.status,
                          });
                          setAssigneeSearch(
                            task.assignee_id != null
                              ? staffNameById.get(task.assignee_id) ??
                                  `#${task.assignee_id}`
                              : ""
                          );
                          setAssigneeHits([]);
                          setDebouncedAssigneeSearch("");
                          setIsModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-xs text-pitch-gray">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTable>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!saving) {
              setIsModalOpen(false);
              setEditingTask(null);
              setFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cj-task-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="cj-task-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingTask ? "Edit task" : "New task"}
            </h2>
            {formError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {formError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitTask}>
              <div>
                <label
                  htmlFor="cj-title"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="cj-title"
                  type="text"
                  required
                  value={taskFormValues.title}
                  onChange={(e) =>
                    setTaskFormValues((v) => ({
                      ...v,
                      title: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div className="relative">
                <label
                  htmlFor="cj-assignee-search"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Assigned to
                </label>
                <div className="flex gap-2">
                  <input
                    id="cj-assignee-search"
                    type="search"
                    autoComplete="off"
                    placeholder="Search by name…"
                    value={assigneeSearch}
                    onChange={(e) => {
                      setAssigneeSearch(e.target.value);
                      setTaskFormValues((prev) => ({
                        ...prev,
                        assigneeId: "",
                      }));
                    }}
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white placeholder:text-pitch-gray focus:border-pitch-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-pitch-gray px-2 py-1 text-[11px] text-pitch-gray-light hover:bg-pitch-gray-dark"
                    onClick={() => {
                      setTaskFormValues((v) => ({ ...v, assigneeId: "" }));
                      setAssigneeSearch("");
                      setAssigneeHits([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                {assigneeSearchLoading ? (
                  <p className="mt-1 text-[11px] text-pitch-gray">
                    Searching…
                  </p>
                ) : null}
                {assigneeHits.length > 0 ? (
                  <ul
                    className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-pitch-gray-dark bg-pitch-bg py-1 text-sm shadow-lg"
                    role="listbox"
                  >
                    {assigneeHits.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-pitch-white hover:bg-pitch-gray-dark"
                          onClick={() => {
                            const fn = staffFullName(s);
                            setTaskFormValues((prev) => ({
                              ...prev,
                              assigneeId: s.id,
                            }));
                            setAssigneeSearch(fn);
                            setAssigneeHits([]);
                            setStaffNameById((prev) =>
                              new Map(prev).set(s.id, fn)
                            );
                          }}
                        >
                          {staffFullName(s)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="cj-team"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Team
                </label>
                <select
                  id="cj-team"
                  className={`w-full ${INPUT_SM_CLASS}`}
                  value={taskFormValues.team}
                  onChange={(e) =>
                    setTaskFormValues((v) => ({ ...v, team: e.target.value }))
                  }
                >
                  <option value="">No team</option>
                  {teamFormSelectOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cj-project"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Project
                </label>
                <input
                  id="cj-project"
                  type="text"
                  list="cookies-jar-projects"
                  placeholder="e.g. Serie A 25/26, onsite productions..."
                  value={taskFormValues.project}
                  onChange={(e) =>
                    setTaskFormValues((v) => ({
                      ...v,
                      project: e.target.value,
                    }))
                  }
                  className={`w-full ${INPUT_SM_CLASS}`}
                />
                <datalist id="cookies-jar-projects">
                  {projectSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label
                  htmlFor="cj-start"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="cj-start"
                  type="date"
                  required
                  value={taskFormValues.startDate}
                  onChange={(e) =>
                    setTaskFormValues((v) => ({
                      ...v,
                      startDate: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="cj-status"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Status
                </label>
                <select
                  id="cj-status"
                  value={taskFormValues.status}
                  onChange={(e) =>
                    setTaskFormValues((v) => ({
                      ...v,
                      status: e.target.value as TaskFormValues["status"],
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  <option value="TODO">TODO</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="DONE">DONE</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:opacity-50"
                  disabled={saving}
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <h2 className="mb-3 mt-10 text-sm font-semibold text-pitch-gray">
        Documents (regulations, specs, procedures)
      </h2>

      <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
        <div>
          <label className="mb-1 block text-[11px] text-pitch-gray">
            Competition
          </label>
          <input
            type="text"
            className={INPUT_SM_CLASS}
            value={docCompetitionFilter}
            onChange={(e) => setDocCompetitionFilter(e.target.value)}
            placeholder="SERIE_A, SERIE_B..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-pitch-gray">
            Category
          </label>
          <select
            className={INPUT_SM_CLASS}
            value={docCategoryFilter}
            onChange={(e) =>
              setDocCategoryFilter(
                e.target.value === ""
                  ? ""
                  : (e.target.value as PitchDocument["category"])
              )
            }
          >
            <option value="">All</option>
            <option value="REGULATION">Regulation</option>
            <option value="TECH_SPEC">Technical spec</option>
            <option value="INTERNAL_PROCEDURE">Internal procedure</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-pitch-gray">Tag</label>
          <input
            type="text"
            className={INPUT_SM_CLASS}
            value={docTagFilter}
            onChange={(e) => setDocTagFilter(e.target.value)}
            placeholder="e.g. interviews"
          />
        </div>
        <div className="ml-auto flex items-end">
          <PrimaryButton
            type="button"
            variant="primary"
            onClick={() => {
              setEditingDoc(null);
              setDocFormError(null);
              setDocFormValues({
                title: "",
                category: "REGULATION",
                competition: "",
                validFrom: "",
                validTo: "",
                tagsText: "",
                filePath: "",
              });
              setIsDocModalOpen(true);
            }}
          >
            New document
          </PrimaryButton>
        </div>
      </div>

      {docsError ? (
        <p className="rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {docsError}
        </p>
      ) : null}
      {docsLoading ? (
        <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading label="Caricamento documenti…" />
        </div>
      ) : null}

      <ResponsiveTable
        className="rounded-lg border border-pitch-gray-dark"
        minWidth="960px"
      >
        <table className="min-w-full divide-y divide-pitch-gray-dark text-xs">
          <thead>
            <tr className="bg-pitch-gray-dark/30">
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Title
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Category
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Competition
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Validity
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Tag
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                File
              </th>
              <th className="px-3 py-2 text-left font-medium text-pitch-gray">
                Created on
              </th>
              <th className="px-3 py-2 text-right font-medium text-pitch-gray">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-gray-dark/50">
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-pitch-gray"
                >
                  Nessun documento per i filtri selezionati.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-pitch-gray-dark/15"
                >
                  <td className="px-3 py-2 text-pitch-white">{doc.title}</td>
                  <td className="px-3 py-2 text-pitch-gray-light">
                    {DOC_CATEGORY_LABEL[doc.category] ?? doc.category}
                  </td>
                  <td className="px-3 py-2 text-pitch-gray-light">
                    {doc.competition || "—"}
                  </td>
                  <td className="px-3 py-2 text-pitch-gray-light">
                    {validityRange(doc)}
                  </td>
                  <td className="px-3 py-2 text-pitch-gray-light">
                    {doc.tags.length > 0 ? doc.tags.join(", ") : "—"}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-3 py-2 text-pitch-gray-light"
                    title={doc.file_path}
                  >
                    {truncateFileLabel(doc.file_path)}
                  </td>
                  <td className="px-3 py-2 text-pitch-gray-light">
                    {createdAtShort(doc.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-[11px] text-pitch-accent underline-offset-2 hover:underline"
                      onClick={() => {
                        setEditingDoc(doc);
                        setDocFormError(null);
                        setDocFormValues({
                          title: doc.title,
                          category: doc.category,
                          competition: doc.competition ?? "",
                          validFrom: toDateInputValue(doc.valid_from),
                          validTo: toDateInputValue(doc.valid_to),
                          tagsText: doc.tags.join(", "),
                          filePath: doc.file_path,
                        });
                        setIsDocModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTable>

      {isDocModalOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!savingDoc) {
              setIsDocModalOpen(false);
              setEditingDoc(null);
              setDocFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="doc-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingDoc ? "Edit document" : "New document"}
            </h2>
            {docFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {docFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitDocument}>
              <div>
                <label
                  htmlFor="doc-title"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="doc-title"
                  type="text"
                  required
                  value={docFormValues.title}
                  onChange={(e) =>
                    setDocFormValues((v) => ({ ...v, title: e.target.value }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-category"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  id="doc-category"
                  required
                  value={docFormValues.category}
                  onChange={(e) =>
                    setDocFormValues((v) => ({
                      ...v,
                      category: e.target.value as DocumentFormValues["category"],
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  <option value="REGULATION">Regulation</option>
                  <option value="TECH_SPEC">Technical spec</option>
                  <option value="INTERNAL_PROCEDURE">Internal procedure</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="doc-competition"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Competition
                </label>
                <input
                  id="doc-competition"
                  type="text"
                  value={docFormValues.competition}
                  onChange={(e) =>
                    setDocFormValues((v) => ({
                      ...v,
                      competition: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="doc-valid-from"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Valid from
                  </label>
                  <input
                    id="doc-valid-from"
                    type="date"
                    value={docFormValues.validFrom}
                    onChange={(e) =>
                      setDocFormValues((v) => ({
                        ...v,
                        validFrom: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="doc-valid-to"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Valid to
                  </label>
                  <input
                    id="doc-valid-to"
                    type="date"
                    value={docFormValues.validTo}
                    onChange={(e) =>
                      setDocFormValues((v) => ({
                        ...v,
                        validTo: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="doc-tags"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Tags (comma separated)
                </label>
                <input
                  id="doc-tags"
                  type="text"
                  placeholder="tag1, tag2, tag3"
                  value={docFormValues.tagsText}
                  onChange={(e) =>
                    setDocFormValues((v) => ({
                      ...v,
                      tagsText: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-file-path"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  File path <span className="text-red-400">*</span>
                </label>
                <input
                  id="doc-file-path"
                  type="text"
                  required
                  value={docFormValues.filePath}
                  onChange={(e) =>
                    setDocFormValues((v) => ({
                      ...v,
                      filePath: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:opacity-50"
                  disabled={savingDoc}
                  onClick={() => {
                    setIsDocModalOpen(false);
                    setEditingDoc(null);
                    setDocFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingDoc}
                >
                  {savingDoc ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="mt-10 border-t border-pitch-gray-dark pt-4">
        <h2 className="mb-2 text-sm font-semibold text-pitch-gray">
          Operational chat (Cookies jar agent)
        </h2>

        <div className="mb-2 max-h-80 overflow-y-auto rounded border border-pitch-gray-dark bg-pitch-gray-dark/20 p-2 text-xs">
          {chatMessages.length === 0 && (
            <p className="text-[11px] text-pitch-gray">
              Start typing a question or operational command (e.g. &quot;Show me
              today&apos;s open tasks for the MEDIA team&quot;).
            </p>
          )}
          {chatLoading ? (
            <div className="mb-2 rounded border border-pitch-accent/60 bg-pitch-bg px-2 py-1.5 text-[11px] text-pitch-gray-light">
              <span className="font-semibold text-pitch-white">Assistant:</span>{" "}
              <span className="animate-pulse text-pitch-accent">…</span>
            </div>
          ) : null}
          {chatMessages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "mb-2 rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1.5 text-[11px] text-pitch-gray-light"
                  : "mb-2 rounded border border-pitch-accent bg-pitch-bg px-2 py-1.5 text-[11px] text-pitch-white"
              }
            >
              <span className="font-semibold text-pitch-white">
                {m.role === "user" ? "You" : "Assistant"}:
              </span>{" "}
              <span className="whitespace-pre-line">{m.content}</span>
            </div>
          ))}
        </div>

        {chatError ? (
          <p className="mb-1 text-[11px] text-red-400">{chatError}</p>
        ) : null}

        <form className="flex gap-2 text-xs" onSubmit={handleChatSubmit}>
          <input
            type="text"
            className={`${INPUT_SM_CLASS} flex-1 min-w-0`}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={
              chatLoading ? "…" : "Write a question or operational command..."
            }
            disabled={chatLoading}
          />
          <button
            type="submit"
            className={PRIMARY_BTN_SM}
            disabled={chatLoading || !chatInput.trim()}
          >
            {chatLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
