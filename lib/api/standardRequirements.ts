import { getApiBaseUrl } from "./config";

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

export async function fetchStandardRequirements(params: {
  standardOnsite: string;
  standardCologno: string;
  site?: string;
  areaProduzione?: string;
  page?: number;
  pageSize?: number;
}): Promise<StandardRequirementWithRole[]> {
  const baseUrl = getApiBaseUrl();
  const url = new URL("/api/standard-requirements", baseUrl);
  url.searchParams.set("standardOnsite", params.standardOnsite);
  url.searchParams.set("standardCologno", params.standardCologno);
  if (params.site) {
    url.searchParams.set("site", params.site);
  }
  if (params.areaProduzione) {
    url.searchParams.set("areaProduzione", params.areaProduzione);
  }
  if (params.page != null) {
    url.searchParams.set("page", String(params.page));
  }
  if (params.pageSize != null) {
    url.searchParams.set("pageSize", String(params.pageSize));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch standard requirements: ${res.status}`);
  }

  const data = await res.json();
  return data.items ?? data;
}

export async function fetchAllStandardRequirements(): Promise<
  StandardRequirementWithRole[]
> {
  const baseUrl = getApiBaseUrl();
  const url = new URL("/api/standard-requirements", baseUrl);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch standard requirements: ${res.status}`);
  }
  const data = await res.json();
  return data.items ?? data ?? [];
}

export async function createStandardRequirement(
  payload: CreateStandardRequirementPayload
): Promise<StandardRequirementWithRole> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/standard-requirements`, {
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/standard-requirements/${id}`, {
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
  eventId: number
): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  const id = Number(eventId);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Invalid eventId: ${eventId}`);
  }
  const url = `${baseUrl}/api/events/${id}/generate-assignments-from-standard`;
  const res = await fetch(url, {
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
