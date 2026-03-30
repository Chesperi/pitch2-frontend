import { getApiBaseUrl } from "./config";

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
  params: FetchDocumentsParams = {}
): Promise<Document[]> {
  const baseUrl = getApiBaseUrl();
  const url = new URL("/api/documents", baseUrl);
  if (params.competition) url.searchParams.set("competition", params.competition);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.tag) url.searchParams.set("tag", params.tag);

  const res = await fetch(url.toString(), { cache: "no-store" });
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents`, {
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}`, {
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
