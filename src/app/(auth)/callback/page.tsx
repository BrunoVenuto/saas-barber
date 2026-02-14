"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type HashParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_code?: string;
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
  const error_code = params.get("error_code") ?? undefined;
  const error_description = params.get("error_description") ?? undefined;

  if (access_token) out.access_token = access_token;
  if (refresh_token) out.refresh_token = refresh_token;
  if (type) out.type = type;
  if (error) out.error = error;
  if (error_code) out.error_code = error_code;
  if (error_description) out.error_description = error_description;

  return out;
}

function getNextFromUrl(): string {
  // /login/callback?next=/login?type=invite
  try {
    const sp = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const next = sp.get("next");
    return next && next.startsWith("/") ? next : "/login";
  } catch {
    return "/login";
  }
}

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export default function LoginCallbackPage() {
  const supabase = createClient();
  const router = useRouter();
  const [msg, setMsg] = useState<string>("Processando...");

  useEffect(() => {
    (async () => {
      const next = getNextFromUrl();

      // 1) Lê hash do Supabase
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const h = parseHash(hash);

      // 2) Se veio erro, manda pro login com mensagem
      if (h.error) {
        const description = h.error_description ?? h.error_code ?? h.error;

        // dica melhor pro otp_expired
        const friendly =
          h.error_code === "otp_expired"
            ? "Link expirado ou já usado. Gere um novo convite e abra o link mais recente."
            : description;

        setMsg(friendly);
        router.replace(`/login?error=${encodeURIComponent(friendly)}`);
        return;
      }

      // 3) Se vieram tokens, cria sessão
      if (h.access_token && h.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: h.access_token,
          refresh_token: h.refresh_token,
        });

        if (error) {
          const m = "Erro ao criar sessão: " + error.message;
          setMsg(m);
          router.replace(`/login?error=${encodeURIComponent(m)}`);
          return;
        }

        // 4) Sincroniza cookies pro middleware enxergar (importantíssimo)
        const payload: SessionTokens = {
          access_token: h.access_token,
          refresh_token: h.refresh_token,
        };

        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // limpa hash (segurança/estética)
        window.history.replaceState({}, "", "/login/callback");

        router.replace(next);
        return;
      }

      // 5) Sem tokens e sem erro → tenta sessão existente
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const m = "Sessão inválida. Abra o link do email novamente.";
        setMsg(m);
        router.replace(`/login?error=${encodeURIComponent(m)}`);
        return;
      }

      // também garante cookies
      const session = data.session;
      if (session.access_token && session.refresh_token) {
        const payload: SessionTokens = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      router.replace(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-zinc-300">{msg}</div>
    </div>
  );
}
