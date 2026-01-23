"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type HashParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_description?: string;
};

function parseHash(hash: string): HashParams {
  const out: HashParams = {};
  const clean = (hash || "").replace(/^#/, "");
  if (!clean) return out;

  const params = new URLSearchParams(clean);

  const access_token = params.get("access_token") ?? undefined;
  const refresh_token = params.get("refresh_token") ?? undefined;
  const type = params.get("type") ?? undefined;
  const error = params.get("error") ?? undefined;
  const error_description = params.get("error_description") ?? undefined;

  if (access_token) out.access_token = access_token;
  if (refresh_token) out.refresh_token = refresh_token;
  if (type) out.type = type;
  if (error) out.error = error;
  if (error_description) out.error_description = error_description;

  return out;
}

function getNextFromUrl(): string {
  // /callback?next=/login?type=invite
  try {
    const sp = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const next = sp.get("next");
    // fallback seguro
    return next && next.startsWith("/") ? next : "/login";
  } catch {
    return "/login";
  }
}

export default function AuthCallbackPage() {
  const supabase = createClient();
  const router = useRouter();

  const [msg, setMsg] = useState<string>("Processando login...");

  useEffect(() => {
    (async () => {
      try {
        const next = getNextFromUrl();

        // 1) Se veio do email (invite/recovery) normalmente vem HASH #access_token=...
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const h = parseHash(hash);

        // Se tiver erro no hash, joga pro login
        if (h.error) {
          setMsg(h.error_description || h.error);
          router.replace("/login");
          return;
        }

        // 2) Se tem tokens no hash, cria sessão manualmente
        if (h.access_token && h.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: h.access_token,
            refresh_token: h.refresh_token,
          });

          if (error) {
            setMsg("Erro ao criar sessão: " + error.message);
            router.replace("/login");
            return;
          }

          // limpa hash/params da URL por estética/segurança
          window.history.replaceState({}, "", "/callback");

          // ✅ volta pro destino (ex: /login?type=invite)
          router.replace(next);
          return;
        }

        // 3) Se não veio hash (ex: login normal), só garante que existe sessão
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setMsg("Sessão inválida. Abra o link do email novamente.");
          router.replace("/login");
          return;
        }

        // ✅ já tem sessão -> segue pro destino
        router.replace(next);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Erro inesperado no callback.";
        setMsg(message);
        router.replace("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-zinc-300">{msg}</div>
    </div>
  );
}
