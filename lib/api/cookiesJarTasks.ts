import { getApiBaseUrl } from "./config";

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
  params: FetchCookiesJarTasksParams
): Promise<CookiesJarTask[]> {
  const baseUrl = getApiBaseUrl();
  const url = new URL("/api/cookies-jar/tasks", baseUrl);
  if (params.date) url.searchParams.set("date", params.date);
  if (params.team) url.searchParams.set("team", params.team);
  if (params.status) url.searchParams.set("status", params.status);

  const res = await fetch(url.toString(), { cache: "no-store" });
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/cookies-jar/tasks`, {
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/cookies-jar/tasks/${id}`, {
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
