import { apiFetch } from "./apiFetch";

export interface VisionEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  /** ISO date/time (from `ko_italy_time` on the event). */
  date: string;
  /** Same instant as `date` when the API sends `ko_italy_time` / `koItalyTime`. */
  koItalyTime: string;
  projectType?: string;
  status: string;
  assignmentsStatus: string;
  studio: string;
  facilities: string;
  standardCologno: string;
  venue: string;
}

export interface VisionProject {
  id: string;
  showName: string;
  client: string;
  type: string;
  color: string;
  episodes: VisionEpisode[];
  totalEpisodes: number;
  doneCount: number;
  activeCount: number;
  firstDate: string;
  lastDate: string;
}

function pickEpisodeInstant(raw: Record<string, unknown>): string {
  return String(
    raw.ko_italy_time ??
      raw.koItalyTime ??
      raw.date ??
      raw.ko_italy ??
      raw.koItaly ??
      ""
  );
}

function normalizeEpisode(raw: Record<string, unknown>): VisionEpisode {
  const instant = pickEpisodeInstant(raw);
  return {
    id: String(raw.id ?? ""),
    episodeNumber: Number(raw.episodeNumber ?? raw.episode_number ?? 0),
    title: String(raw.title ?? ""),
    date: instant,
    koItalyTime: instant,
    projectType:
      raw.projectType != null
        ? String(raw.projectType)
        : raw.project_type != null
          ? String(raw.project_type)
          : undefined,
    status: String(raw.status ?? ""),
    assignmentsStatus: String(raw.assignmentsStatus ?? raw.assignments_status ?? ""),
    studio: String(raw.studio ?? ""),
    facilities: String(raw.facilities ?? ""),
    standardCologno: String(raw.standardCologno ?? raw.standard_cologno ?? ""),
    venue: String(raw.venue ?? ""),
  };
}

function normalizeProject(raw: Record<string, unknown>): VisionProject {
  const episodesRaw = Array.isArray(raw.episodes) ? raw.episodes : [];
  return {
    id: String(raw.id ?? ""),
    showName: String(raw.showName ?? raw.show_name ?? ""),
    client: String(raw.client ?? raw.competition_name ?? ""),
    type: String(raw.type ?? "Branded"),
    color: String(raw.color ?? "#888888"),
    episodes: episodesRaw.map((ep) => normalizeEpisode(ep as Record<string, unknown>)),
    totalEpisodes: Number(raw.totalEpisodes ?? raw.total_episodes ?? episodesRaw.length),
    doneCount: Number(raw.doneCount ?? raw.done_count ?? 0),
    activeCount: Number(raw.activeCount ?? raw.active_count ?? 0),
    firstDate: String(raw.firstDate ?? raw.first_date ?? ""),
    lastDate: String(raw.lastDate ?? raw.last_date ?? ""),
  };
}

export async function fetchVisionProjects(): Promise<VisionProject[]> {
  const res = await apiFetch("/api/vision/projects", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch vision projects: ${res.status}`);
  const data = (await res.json()) as { items?: unknown[] } | unknown[];
  const rows = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  return rows.map((row) => normalizeProject(row as Record<string, unknown>));
}
