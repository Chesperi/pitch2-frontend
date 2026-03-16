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

export async function fetchStandardRequirements(params: {
  standardOnsite: string;
  standardCologno: string;
  site?: string;
  areaProduzione?: string;
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
