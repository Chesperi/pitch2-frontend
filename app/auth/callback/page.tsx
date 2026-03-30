"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  assignmentsHomeForUserLevel,
  fetchPitch2MeFromBrowser,
  pickUserLevel,
  postSupabaseSessionToBackend,
} from "@/lib/auth/pitch2Session";

/**
 * Magic link Supabase (PKCE): redirect con ?code=...
 * Configurare in Supabase Dashboard: Site URL / Redirect URLs → https://<dominio>/auth/callback
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completamento accesso…");

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const errParam =
        searchParams.get("error_description") ?? searchParams.get("error");

      if (errParam) {
        setMessage(String(errParam));
        return;
      }

      if (!code) {
        setMessage("Parametro code mancante. Apri il link dall’email o vai al login.");
        return;
      }

      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session?.access_token) {
          console.error("exchangeCodeForSession", error);
          router.replace("/login?error=session");
          return;
        }

        const sessionRes = await postSupabaseSessionToBackend(
          data.session.access_token
        );

        if (!sessionRes.ok) {
          router.replace("/login?error=backend_session");
          return;
        }

        const me = await fetchPitch2MeFromBrowser();
        if (!me.ok || !me.data) {
          router.replace("/login?error=me");
          return;
        }

        const path = assignmentsHomeForUserLevel(pickUserLevel(me.data));
        router.replace(path);
      } catch (e) {
        console.error(e);
        router.replace("/login?error=unknown");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <p className="text-sm text-pitch-gray">{message}</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento…</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
