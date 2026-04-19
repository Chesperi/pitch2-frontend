import { apiFetch } from "./apiFetch";

export type StaffRoleFee = {
  id: number;
  staffId: number;
  roleCode: string;
  location: string;
  fee: number;
  extraFee: number;
  notes?: string;
  isPrimary: boolean;
  active: boolean;
};

export async function fetchRolesByStaff(
  staffId: number
): Promise<StaffRoleFee[]> {
  const res = await apiFetch(`/api/staff-roles?staffId=${staffId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load roles: ${res.status}`);
  const data = (await res.json()) as { roles?: StaffRoleFee[] };
  return data.roles ?? [];
}

export async function upsertStaffRole(payload: {
  staffId: number;
  roleCode: string;
  location: string;
  fee: number;
  extraFee: number;
  isPrimary?: boolean;
  notes?: string | null;
  active?: boolean;
}): Promise<StaffRoleFee> {
  const res = await apiFetch("/api/staff-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staffId: payload.staffId,
      roleCode: payload.roleCode,
      location: payload.location,
      fee: payload.fee,
      extraFee: payload.extraFee,
      isPrimary: payload.isPrimary,
      notes: payload.notes,
      active: payload.active,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Save role failed: ${res.status}`
    );
  }
  return res.json();
}

export async function updateStaffRole(
  id: number,
  payload: Partial<StaffRoleFee> & { staffId: number }
): Promise<StaffRoleFee> {
  const res = await apiFetch(`/api/staff-roles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Update role failed: ${res.status}`
    );
  }
  return res.json();
}

export async function deleteStaffRole(id: number): Promise<void> {
  const res = await apiFetch(`/api/staff-roles/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Delete role failed: ${res.status}`
    );
  }
}

export async function fetchStaffByRole(
  roleCode: string,
  location: string
): Promise<
  Array<{
    staffId: number;
    surname: string;
    name: string;
    company: string | null;
    plates: string | null;
    roles: StaffRoleFee[];
  }>
> {
  const qs = new URLSearchParams({
    roleCode,
    location,
  });
  const res = await apiFetch(`/api/staff-roles/by-role?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed staff by role: ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{
      staffId: number;
      surname: string;
      name: string;
      company: string | null;
      plates: string | null;
      roles: StaffRoleFee[];
    }>;
  };
  return data.items ?? [];
}
