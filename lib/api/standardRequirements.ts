import { apiFetch, apiFetchServer } from "./apiFetch";

export interface StandardRequirementWithRole {
  id: number;
  standardOnsite: string;
  standardCologno: string;
  site: string; // sede: STADIO | COLOGNO
  areaProduzione: string;
  quantity: number;
  notes: string | null;
  roleCode: string;
  roleName: string | null;
  roleLocation: string;
  coverageType: "FREELANCE" | "PROVIDER" | "EITHER";
  facilities?: string | null;
  studio?: string | null;
}

export type CreateStandardRequirementPayload = {
  standardOnsite: string;
  standardCologno: string;
  site?: string;
  areaProduzione?: string | null;
  roleCode: string;
  roleLocation: string;
  quantity?: number;
  notes?: string | null;
  coverageType?: "FREELANCE" | "PROVIDER" | "EITHER";
};

export type UpdateStandardRequirementPayload =
  Partial<CreateStandardRequirementPayload>;

function standardRequirementJsonBody(
  payload: CreateStandardRequirementPayload | UpdateStandardRequirementPayload
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (payload.standardOnsite !== undefined)
    o.standardOnsite = payload.standardOnsite;
  if (payload.standardCologno !== undefined)
    o.standardCologno = payload.standardCologno;
  if (payload.site !== undefined) o.site = payload.site;
  if (payload.areaProduzione !== undefined)
    o.areaProduzione = payload.areaProduzione;
  if (payload.roleCode !== undefined) o.roleCode = payload.roleCode;
  if (payload.roleLocation !== undefined) o.roleLocation = payload.roleLocation;
  if (payload.quantity !== undefined) o.quantity = payload.quantity;
  if (payload.notes !== undefined) o.notes = payload.notes;
  if (payload.coverageType !== undefined) o.coverageType = payload.coverageType;
  return o;
}

export type StandardRequirementsFetchOptions = {
  cookieHeader?: string;
};

function mapStandardRequirement(
  raw: Record<string, unknown>
): StandardRequirementWithRole {
  return {
    id: Number(raw.id ?? 0),
    standardOnsite: String(raw.standardOnsite ?? raw.standard_onsite ?? ""),
    standardCologno: String(
      raw.standardCologno ?? raw.standard_cologno ?? ""
    ),
    site: String(raw.site ?? ""),
    areaProduzione: String(raw.areaProduzione ?? raw.area_produzione ?? ""),
    roleCode: String(raw.roleCode ?? raw.role_code ?? ""),
    roleName: (raw.roleName ??
      raw.role_name ??
      raw.roleDescription ??
      raw.role_description ??
      null) as string | null,
    roleLocation: String(raw.roleLocation ?? raw.role_location ?? ""),
    quantity: Number(raw.quantity ?? 1),
    notes: (raw.notes as string | null) ?? null,
    coverageType: (String(
      raw.coverageType ?? raw.coverage_type ?? "FREELANCE"
    ).toUpperCase() as "FREELANCE" | "PROVIDER" | "EITHER"),
    facilities: (raw.facilities as string | null) ?? null,
    studio: (raw.studio as string | null) ?? null,
  };
}

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
  const items = (data.items ?? data ?? []) as Record<string, unknown>[];
  return items.map(mapStandardRequirement);
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
  const items = (data.items ?? data ?? []) as Record<string, unknown>[];
  return items.map(mapStandardRequirement);
}

export async function createStandardRequirement(
  payload: CreateStandardRequirementPayload
): Promise<StandardRequirementWithRole> {
  const res = await apiFetch("/api/standard-requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(standardRequirementJsonBody(payload)),
  });
  if (!res.ok) {
    throw new Error(
      await readStandardRequirementErrorMessage(
        res,
        `Failed to create standard requirement: ${res.status}`
      )
    );
  }
  const data = (await res.json()) as Record<string, unknown>;
  return mapStandardRequirement(data);
}

export async function updateStandardRequirement(
  id: number,
  payload: UpdateStandardRequirementPayload
): Promise<StandardRequirementWithRole> {
  const res = await apiFetch(`/api/standard-requirements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(standardRequirementJsonBody(payload)),
  });
  if (!res.ok) {
    throw new Error(
      await readStandardRequirementErrorMessage(
        res,
        `Failed to update standard requirement: ${res.status}`
      )
    );
  }
  const data = (await res.json()) as Record<string, unknown>;
  return mapStandardRequirement(data);
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
