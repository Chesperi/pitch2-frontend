import { apiFetch, apiFetchServer } from "./apiFetch";

export interface StandardRequirementWithRole {
  id: number;
  standardOnsite: string;
  standardCologno: string;
  site: string; // sede: STADIO | COLOGNO
  areaProduzione: string;
  roleId: number;
  quantity: number;
  notes: string | null;
  roleCode: string;
  roleName: string;
  roleLocation: string;
}

export type CreateStandardRequirementPayload = {
  standardOnsite: string;
  standardCologno: string;
  site?: string;
  areaProduzione?: string | null;
  roleId: number;
  quantity?: number;
  notes?: string | null;
};

export type UpdateStandardRequirementPayload =
  Partial<CreateStandardRequirementPayload>;

export type StandardRequirementsFetchOptions = {
  cookieHeader?: string;
};

async function readStandardRequirementErrorMessage(
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

function standardRequirementsQueryPath(params: {
  standardOnsite: string;
  standardCologno: string;
  site?: string;
  areaProduzione?: string;
  page?: number;
  pageSize?: number;
}): string {
  const q = new URLSearchParams();
  q.set("standardOnsite", params.standardOnsite);
  q.set("standardCologno", params.standardCologno);
  if (params.site) q.set("site", params.site);
  if (params.areaProduzione) q.set("areaProduzione", params.areaProduzione);
  if (params.page != null) q.set("page", String(params.page));
  if (params.pageSize != null) q.set("pageSize", String(params.pageSize));
  return `/api/standard-requirements?${q.toString()}`;
}

export async function fetchStandardRequirements(
  params: {
    standardOnsite: string;
    standardCologno: string;
    site?: string;
    areaProduzione?: string;
    page?: number;
    pageSize?: number;
  },
  options?: StandardRequirementsFetchOptions
): Promise<StandardRequirementWithRole[]> {
  const path = standardRequirementsQueryPath(params);
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch standard requirements: ${res.status}`);
  }

  const data = await res.json();
  return data.items ?? data;
}

export async function fetchAllStandardRequirements(
  options?: StandardRequirementsFetchOptions
): Promise<StandardRequirementWithRole[]> {
  const path = "/api/standard-requirements";
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch standard requirements: ${res.status}`);
  }
  const data = await res.json();
  return data.items ?? data ?? [];
}

export async function createStandardRequirement(
  payload: CreateStandardRequirementPayload
): Promise<StandardRequirementWithRole> {
  const res = await apiFetch("/api/standard-requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readStandardRequirementErrorMessage(
        res,
        `Failed to create standard requirement: ${res.status}`
      )
    );
  }
  return (await res.json()) as StandardRequirementWithRole;
}

export async function updateStandardRequirement(
  id: number,
  payload: UpdateStandardRequirementPayload
): Promise<StandardRequirementWithRole> {
  const res = await apiFetch(`/api/standard-requirements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readStandardRequirementErrorMessage(
        res,
        `Failed to update standard requirement: ${res.status}`
      )
    );
  }
  return (await res.json()) as StandardRequirementWithRole;
}

export async function generateAssignmentsFromStandard(
  eventId: string
): Promise<unknown> {
  const id = String(eventId).trim();
  if (!id) {
    throw new Error(`Invalid eventId: ${eventId}`);
  }
  const path = `/api/events/${encodeURIComponent(id)}/generate-assignments-from-standard`;
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to generate assignments from standard: ${res.status}`
    );
  }

  return res.json();
}
