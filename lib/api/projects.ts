export type PhaseStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export type PhaseName =
  | "CONCEPT" | "BRAND_IDENTITY" | "WT_TECH_DEV" | "WT_DESIGN"
  | "VMIX_DEV" | "ALLEST_SET" | "PROVE_TEST" | "REC"
  | "EDIT" | "PROMOZIONE" | "DISTRIBUZIONE" | "ON_AIR";

export interface WorkBlock {
  id: number;
  phase_id: number;
  role_code: string;
  location: string;
  quantity: number;
  hours_per_session: number;
  notes: string | null;
}

export interface ProjectPhaseSession {
  id: number;
  phase_id: number;
  project_id: number;
  session_date: string;
  date_to: string | null;
  label: string | null;
  notes: string | null;
  status: string;
}

export interface ProjectPhase {
  id: number;
  project_id: number;
  phase_name: PhaseName;
  date_from: string | null;
  date_to: string | null;
  status: PhaseStatus;
  episodes_completed: number;
  notes: string | null;
  sort_order: number;
  work_blocks: WorkBlock[];
  project_phase_sessions: ProjectPhaseSession[];
}

export interface Project {
  id: number;
  name: string;
  client: string | null;
  project_type: string;
  total_episodes: number;
  notes: string | null;
  active: boolean;
  project_phases: ProjectPhase[];
}

export interface ProjectPayload {
  name: string;
  project_type: string;
  total_episodes: number;
  client?: string | null;
  notes?: string | null;
  phases?: {
    phase_name: PhaseName;
    date_from?: string | null;
    date_to?: string | null;
    status?: PhaseStatus;
    episodes_completed?: number;
    notes?: string | null;
    work_blocks?: {
      role_code: string;
      location?: string;
      quantity?: number;
      hours_per_session?: number;
      notes?: string | null;
    }[];
    sessions?: {
      session_date: string;
      date_to?: string | null;
      label?: string | null;
      notes?: string | null;
      status?: string;
    }[];
  }[];
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects", { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`fetchProjects error: ${res.status}`);
  return res.json();
}

export async function fetchProject(id: number): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`fetchProject error: ${res.status}`);
  return res.json();
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createProject error: ${res.status}`);
  return res.json();
}

export async function updateProject(id: number, payload: Partial<ProjectPayload>): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateProject error: ${res.status}`);
  return res.json();
}

export async function updatePhase(phaseId: number, payload: {
  date_from?: string | null;
  date_to?: string | null;
  status?: PhaseStatus;
  episodes_completed?: number;
  notes?: string | null;
}): Promise<ProjectPhase> {
  const res = await fetch(`/api/projects/phases/${phaseId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updatePhase error: ${res.status}`);
  return res.json();
}

export async function createSession(
  phaseId: number,
  payload: {
    session_date: string;
    date_to?: string | null;
    label?: string | null;
    notes?: string | null;
    status?: string;
  }
): Promise<ProjectPhaseSession> {
  const res = await fetch(`/api/projects/phases/${phaseId}/sessions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createSession error: ${res.status}`);
  return res.json();
}

export async function updateSession(
  phaseId: number,
  sessionId: number,
  payload: {
    session_date?: string;
    date_to?: string | null;
    label?: string | null;
    notes?: string | null;
    status?: string;
  }
): Promise<ProjectPhaseSession> {
  const res = await fetch(`/api/projects/phases/${phaseId}/sessions/${sessionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateSession error: ${res.status}`);
  return res.json();
}

export async function deleteSession(phaseId: number, sessionId: number): Promise<void> {
  const res = await fetch(`/api/projects/phases/${phaseId}/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`deleteSession error: ${res.status}`);
}

export const PHASE_COLORS: Record<PhaseName, { bg: string; text: string }> = {
  CONCEPT:        { bg: "#CECBF6", text: "#26215C" },
  BRAND_IDENTITY: { bg: "#9FE1CB", text: "#04342C" },
  WT_TECH_DEV:    { bg: "#B5D4F4", text: "#042C53" },
  WT_DESIGN:      { bg: "#FAC775", text: "#412402" },
  VMIX_DEV:       { bg: "#F5C4B3", text: "#4A1B0C" },
  ALLEST_SET:     { bg: "#C0DD97", text: "#173404" },
  PROVE_TEST:     { bg: "#F7C1C1", text: "#501313" },
  REC:            { bg: "#E24B4A", text: "#ffffff" },
  EDIT:           { bg: "#378ADD", text: "#ffffff" },
  PROMOZIONE:     { bg: "#D4537E", text: "#ffffff" },
  DISTRIBUZIONE:  { bg: "#888780", text: "#ffffff" },
  ON_AIR:         { bg: "#639922", text: "#ffffff" },
};

export const PHASE_LABELS: Record<PhaseName, string> = {
  CONCEPT:        "Concept / Script",
  BRAND_IDENTITY: "Brand Identity",
  WT_TECH_DEV:    "WT Tech DEV",
  WT_DESIGN:      "WT Design",
  VMIX_DEV:       "Vmix DEV",
  ALLEST_SET:     "Allest Set",
  PROVE_TEST:     "Prove / Test",
  REC:            "Rec",
  EDIT:           "Edit",
  PROMOZIONE:     "Promozione",
  DISTRIBUZIONE:  "Distribuzione",
  ON_AIR:         "On Air",
};

export const ALL_PHASES: PhaseName[] = [
  "CONCEPT", "BRAND_IDENTITY", "WT_TECH_DEV", "WT_DESIGN",
  "VMIX_DEV", "ALLEST_SET", "PROVE_TEST", "REC",
  "EDIT", "PROMOZIONE", "DISTRIBUZIONE", "ON_AIR",
];

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  BRANDED:   "#4A90D9",
  EDITORIAL: "#639922",
  TECH:      "#E8A838",
  PLATFORM:  "#9B59B6",
};
