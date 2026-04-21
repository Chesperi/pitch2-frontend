import { apiFetch } from "./apiFetch";

export type SergioConversation = {
  id: number;
  title: string;
  updated_at: string;
};

export type SergioMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_calls?: unknown;
  tool_results?: unknown;
  created_at: string;
};

export type SergioResponse = {
  reply: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  toolResults?: Array<{ name: string; result: unknown }>;
};

export async function fetchSergioConversations(): Promise<SergioConversation[]> {
  const res = await apiFetch("/api/sergio/conversations", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.status}`);
  const data = (await res.json()) as { items?: SergioConversation[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function createSergioConversation(
  title?: string
): Promise<SergioConversation> {
  const res = await apiFetch("/api/sergio/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
  return (await res.json()) as SergioConversation;
}

export async function deleteSergioConversation(id: number): Promise<void> {
  const res = await apiFetch(`/api/sergio/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete conversation: ${res.status}`);
  }
}

export async function fetchSergioMessages(convId: number): Promise<SergioMessage[]> {
  const res = await apiFetch(`/api/sergio/conversations/${convId}/messages`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const data = (await res.json()) as { items?: SergioMessage[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function sendSergioMessage(
  convId: number,
  content: string,
  imageBase64?: string
): Promise<SergioResponse> {
  const res = await apiFetch(`/api/sergio/conversations/${convId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, imageBase64 }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  return (await res.json()) as SergioResponse;
}
