import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  assignmentsHomeForUserLevel,
  fetchPitch2MeFromServer,
  pickUserLevel,
} from "@/lib/auth/pitch2Session";

/**
 * Server Component: inoltra i cookie del browser al backend per leggere pitch2_session.
 * - 200 + profilo → redirect alla home assegnazioni in base a user_level.
 * - 401 / assenza sessione → /login (flusso Supabase password o magic link da lì).
 *
 * TODO: se il backend espone 403 o "password required", redirect a /set-password.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const { ok, status, data } = await fetchPitch2MeFromServer(cookieHeader);

  if (!ok || status === 401) {
    redirect("/login");
  }

  const level = pickUserLevel(data);
  redirect(assignmentsHomeForUserLevel(level));
}
