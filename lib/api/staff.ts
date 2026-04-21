import { apiFetch, apiFetchServer } from "./apiFetch";
import type { StaffRoleFee } from "./staffRoles";

export type StaffItem = {
  id: number;
  surname: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  plates: string | null;
  user_level: string;
  active: boolean;
  place_of_birth: string | null;
  date_of_birth: string | null;
  residential_address: string | null;
  id_number: string | null;
  team_dazn: string | null;
  notes: string | null;
  finance_visibility: "HIDDEN" | "VISIBLE" | null;
  shifts_management?: boolean;
  managed_teams?: string[] | null;
  sergio_access?: boolean;
  /** Present when loaded with includeRoles=true or from detail GET /api/staff/:id */
  roles?: StaffRoleFee[];
};

export type StaffListResponse = {
  items: StaffItem[];
  total: number;
};

export type CreateStaffPayload = {
  surname: string;
  name: string;
  email: string;
  userLevel?: string;
  active?: boolean;
  phone?: string | null;
  company?: string | null;
  plates?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  residentialAddress?: string | null;
  idNumber?: string | null;
  teamDazn?: string | null;
  notes?: string | null;
  financeVisibility?: "HIDDEN" | "VISIBLE" | null;
};

export type UpdateStaffPayload = Partial<CreateStaffPayload> & {
  shiftsManagement?: boolean;
  managedTeams?: string[];
  sergioAccess?: boolean;
};

export type StaffFetchOptions = {
  /** Per Server Components: header Cookie da `cookies()` */
  cookieHeader?: string;
};

async function readStaffErrorMessage(
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

export async function fetchStaff(
  params?: {
    q?: string;
    role_code?: string;
    location?: string;
    limit?: number;
    offset?: number;
    /** When true, each item includes roles[] from staff_role_fees */
    includeRoles?: boolean;
  },
  options?: StaffFetchOptions
): Promise<StaffListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.role_code) searchParams.set("role_code", params.role_code);
  if (params?.location) searchParams.set("location", params.location);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.includeRoles) searchParams.set("includeRoles", "true");

  const qs = searchParams.toString();
  const path = `/api/staff${qs ? `?${qs}` : ""}`;
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.status}`);
  return res.json();
}

export async function createStaff(
  payload: CreateStaffPayload
): Promise<StaffItem> {
  const res = await apiFetch("/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readStaffErrorMessage(res, `Failed to create staff: ${res.status}`)
    );
  }
  return (await res.json()) as StaffItem;
}

export async function updateStaff(
  id: number,
  payload: UpdateStaffPayload
): Promise<StaffItem> {
  const res = await apiFetch(`/api/staff/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readStaffErrorMessage(res, `Failed to update staff: ${res.status}`)
    );
  }
  return (await res.json()) as StaffItem;
}

/** Invia email di invito al membro staff (ripetibile). */
export async function inviteStaff(id: number): Promise<void> {
  const res = await apiFetch(`/api/staff/${id}/invite`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await readStaffErrorMessage(res, `Invito fallito: ${res.status}`)
    );
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    await res.json().catch(() => undefined);
  } else {
    await res.text().catch(() => undefined);
  }
}

export async function deleteStaff(id: number): Promise<void> {
  const res = await apiFetch(`/api/staff/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await readStaffErrorMessage(res, `Eliminazione fallita: ${res.status}`)
    );
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    await res.json().catch(() => undefined);
  } else {
    await res.text().catch(() => undefined);
  }
}
