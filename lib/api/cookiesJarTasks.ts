import { apiFetch, apiFetchServer } from "./apiFetch";

export type CookiesJarTask = {
  id: number;
  title: string;
  assignee_id: number | null;
  team: string;
  project: string;
  start_date: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "ON_HOLD";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FetchCookiesJarTasksParams = {
  date?: string;
  team?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE" | "ON_HOLD";
};

export type CreateCookiesJarTaskPayload = {
  title: string;
  assigneeId?: number;
  team?: string;
  project?: string;
  startDate: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE" | "ON_HOLD";
};

export type UpdateCookiesJarTaskPayload =
  Partial<Omit<CreateCookiesJarTaskPayload, "assigneeId">> & {
    assigneeId?: number | null;
  };

export type CookiesJarFetchOptions = {
  cookieHeader?: string;
};

async function readCookiesJarError(
  res: Response,
  fallback: string
): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCookiesJarTasks(
  params: FetchCookiesJarTasksParams,
  options?: CookiesJarFetchOptions
): Promise<CookiesJarTask[]> {
  const q = new URLSearchParams();
  if (params.date) q.set("date", params.date);
  if (params.team) q.set("team", params.team);
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  const path = `/api/cookies-jar/tasks${qs ? `?${qs}` : ""}`;
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      await readCookiesJarError(
        res,
        `Failed to fetch cookies jar tasks: ${res.status}`
      )
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createCookiesJarTask(
  payload: CreateCookiesJarTaskPayload
): Promise<CookiesJarTask> {
  const res = await apiFetch("/api/cookies-jar/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readCookiesJarError(
        res,
        `Failed to create cookies jar task: ${res.status}`
      )
    );
  }
  return (await res.json()) as CookiesJarTask;
}

export async function updateCookiesJarTask(
  id: number,
  payload: UpdateCookiesJarTaskPayload
): Promise<CookiesJarTask> {
  const res = await apiFetch(`/api/cookies-jar/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readCookiesJarError(
        res,
        `Failed to update cookies jar task: ${res.status}`
      )
    );
  }
  return (await res.json()) as CookiesJarTask;
}
