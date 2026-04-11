import { apiFetch, apiFetchServer } from "./apiFetch";
import type { StandardRequirementWithRole } from "./standardRequirements";

export interface StandardCombo {
  id: number;
  standardOnsite: string;
  standardCologno: string;
  facilities: string | null;
  studio: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StandardComboWithRequirements extends StandardCombo {
  requirements: StandardRequirementWithRole[];
}

export type ComboRequirementInput = {
  roleCode: string;
  roleLocation: string;
  quantity?: number;
  coverageType?: "FREELANCE" | "PROVIDER" | "EITHER";
  notes?: string | null;
};

export type CreateStandardComboPayload = {
  standardOnsite: string;
  standardCologno: string;
  facilities?: string | null;
  studio?: string | null;
  notes?: string | null;
  requirements: ComboRequirementInput[];
};

export type UpdateStandardComboPayload = Partial<
  Omit<CreateStandardComboPayload, "requirements">
> & {
  requirements?: ComboRequirementInput[];
};

export type StandardCombosFetchOptions = {
  cookieHeader?: string;
};

function mapRequirement(raw: Record<string, unknown>): StandardRequirementWithRole {
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
    standardComboId:
      raw.standardComboId != null
        ? Number(raw.standardComboId)
        : raw.standard_combo_id != null
          ? Number(raw.standard_combo_id)
          : undefined,
  };
}

function mapCombo(raw: Record<string, unknown>): StandardComboWithRequirements {
  const reqs = raw.requirements;
  return {
    id: Number(raw.id ?? 0),
    standardOnsite: String(raw.standardOnsite ?? raw.standard_onsite ?? ""),
    standardCologno: String(
      raw.standardCologno ?? raw.standard_cologno ?? ""
    ),
    facilities: (raw.facilities as string | null) ?? null,
    studio: (raw.studio as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    requirements: Array.isArray(reqs)
      ? (reqs as Record<string, unknown>[]).map(mapRequirement)
      : [],
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchStandardCombos(
  options?: StandardCombosFetchOptions
): Promise<StandardComboWithRequirements[]> {
  const path = "/api/standard-combos";
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch standard combos: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];
  return data.map(mapCombo);
}

export async function createStandardCombo(
  data: CreateStandardComboPayload
): Promise<StandardComboWithRequirements> {
  const res = await apiFetch("/api/standard-combos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Create combo failed: ${res.status}`));
  }
  const json = (await res.json()) as Record<string, unknown>;
  return mapCombo(json);
}

export async function updateStandardCombo(
  id: number,
  data: UpdateStandardComboPayload
): Promise<StandardComboWithRequirements> {
  const res = await apiFetch(`/api/standard-combos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Update combo failed: ${res.status}`));
  }
  const json = (await res.json()) as Record<string, unknown>;
  return mapCombo(json);
}

export async function deleteStandardCombo(id: number): Promise<void> {
  const res = await apiFetch(`/api/standard-combos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(await readError(res, `Delete combo failed: ${res.status}`));
  }
}
