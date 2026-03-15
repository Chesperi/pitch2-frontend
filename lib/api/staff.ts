import { getApiBaseUrl } from "./config";

export type StaffItem = {
  id: number;
  surname: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  default_role_code: string | null;
  default_location: string | null;
  fee: number | null;
  plates: string | null;
  user_level: string;
  active: boolean;
};

export type StaffListResponse = {
  items: StaffItem[];
  total: number;
};

export async function fetchStaff(params?: {
  q?: string;
  role_code?: string;
  location?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.role_code) searchParams.set("role_code", params.role_code);
  if (params?.location) searchParams.set("location", params.location);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));

  const url = `${getApiBaseUrl()}/api/staff${searchParams.toString() ? `?${searchParams}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.status}`);
  return res.json();
}
