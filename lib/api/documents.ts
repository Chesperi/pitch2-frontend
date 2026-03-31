import { apiFetch, apiFetchServer } from "./apiFetch";

export type Document = {
  id: number;
  title: string;
  category: "REGULATION" | "TECH_SPEC" | "INTERNAL_PROCEDURE" | "OTHER";
  competition: string;
  valid_from: string | null;
  valid_to: string | null;
  tags: string[];
  file_path: string;
  uploaded_by_id: number | null;
  created_at: string;
};

export type FetchDocumentsParams = {
  competition?: string;
  category?: Document["category"];
  tag?: string;
};

export type CreateDocumentPayload = {
  title: string;
  category: Document["category"];
  competition?: string;
  validFrom?: string | null;
  validTo?: string | null;
  tags?: string[];
  filePath: string;
  uploadedById?: number | null;
};

export type UpdateDocumentPayload = Partial<CreateDocumentPayload>;

export type DocumentsFetchOptions = {
  cookieHeader?: string;
};

async function readDocumentError(
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

export async function fetchDocuments(
  params: FetchDocumentsParams = {},
  options?: DocumentsFetchOptions
): Promise<Document[]> {
  const q = new URLSearchParams();
  if (params.competition) q.set("competition", params.competition);
  if (params.category) q.set("category", params.category);
  if (params.tag) q.set("tag", params.tag);
  const qs = q.toString();
  const path = `/api/documents${qs ? `?${qs}` : ""}`;
  const res = options?.cookieHeader
    ? await apiFetchServer(path, options.cookieHeader, { cache: "no-store" })
    : await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      await readDocumentError(res, `Failed to fetch documents: ${res.status}`)
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createDocument(
  payload: CreateDocumentPayload
): Promise<Document> {
  const res = await apiFetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readDocumentError(res, `Failed to create document: ${res.status}`)
    );
  }
  return (await res.json()) as Document;
}

export async function updateDocument(
  id: number,
  payload: UpdateDocumentPayload
): Promise<Document> {
  const res = await apiFetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readDocumentError(res, `Failed to update document: ${res.status}`)
    );
  }
  return (await res.json()) as Document;
}
