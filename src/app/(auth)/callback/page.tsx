// ✅ ARQUIVO: src/app/auth/callback/page.tsx
// Crie exatamente essa pasta/arquivo (ou substitua, se já existir):
// src/app/auth/callback/page.tsx

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Essa página existe porque:
 * - Links de convite/recovery do Supabase vêm com tokens no HASH (#access_token=...)
 * - O server (route.ts) NÃO enxerga hash
 *
 * Então:
 * 1) Lê o hash no browser
 * 2) Converte hash -> querystring
 * 3) Redireciona para /auth/callback (route.ts) que cria a sessão via cookies
 * 4) route.ts manda pro /update-password
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    // 1) Se veio code por query (?code=...), manda direto pro route handler
    const code = search.get("code");
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
      return;
    }

    // 2) Se não tem code, tentamos ler o HASH (#access_token=...&refresh_token=...)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || hash.length < 2) {
      // nada pra trocar, manda pro login com msg
      router.replace("/login?error=missing_hash&error_description=Link%20inv%C3%A1lido%20ou%20expirado");
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    // Alguns links podem vir com "error" no hash
    const error = params.get("error");
    const error_description = params.get("error_description");

    if (error) {
      router.replace(
        `/login?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(
          error_description || "Falha ao autenticar."
        )}`
      );
      return;
    }

    if (!access_token || !refresh_token) {
      router.replace(
        "/login?error=missing_tokens&error_description=Tokens%20n%C3%A3o%20encontrados%20no%20link%20do%20email"
      );
      return;
    }

    // 3) Redireciona para o route.ts com querystring (server consegue ler)
    router.replace(
      `/auth/callback?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(
        refresh_token
      )}`
    );
  }, [router, search]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-zinc-300">Validando convite...</div>
    </div>
  );
}
