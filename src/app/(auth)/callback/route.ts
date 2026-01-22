// ✅ ARQUIVO: src/app/auth/callback/route.ts
// Crie exatamente essa pasta/arquivo (ou substitua, se já existir):
// src/app/auth/callback/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Tipagem compatível com o @supabase/ssr
type SupabaseCookieOptions = Partial<{
  path: string;
  domain: string;
  maxAge: number;
  expires: Date;
  httpOnly: boolean;
  secure: boolean;
  sameSite: boolean | "lax" | "strict" | "none";
}>;

type SupabaseCookieToSet = {
  name: string;
  value: string;
  options: SupabaseCookieOptions;
};

export async function GET(req: NextRequest) {
  // Guarda cookies que o Supabase pedir para setar (e aplica no response final)
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({ name, value, ...options });
    });
    return response;
  };

  const url = req.nextUrl.clone();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Não vaza valores, só avisa
    url.pathname = "/login";
    url.searchParams.set("error", "missing_env");
    url.searchParams.set("error_description", "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes");
    return applyPendingCookies(NextResponse.redirect(url));
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies: SupabaseCookieToSet[]) {
        pendingCookies.push(...cookies);
      },
    },
  });

  // ⚠️ IMPORTANTE:
  // Supabase (invite/recovery) envia tokens no HASH (#access_token=...),
  // e o server NÃO enxerga hash.
  //
  // Então este endpoint precisa ser chamado com querystring, tipo:
  // /auth/callback?code=...
  // OU você precisa de uma página client /auth/callback/page.tsx
  // que lê o hash no browser e redireciona para este route com query.
  //
  // Mesmo assim, vamos suportar:
  // - ?code=... (OAuth / PKCE)
  // - ?access_token=...&refresh_token=... (se você converter no client)

  const code = url.searchParams.get("code");
  const access_token = url.searchParams.get("access_token");
  const refresh_token = url.searchParams.get("refresh_token");

  try {
    if (code) {
      // Fluxo padrão OAuth/PKCE
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const to = req.nextUrl.clone();
        to.pathname = "/login";
        to.searchParams.set("error", "exchange_code_failed");
        to.searchParams.set("error_description", error.message);
        return applyPendingCookies(NextResponse.redirect(to));
      }

      // ✅ Sessão criada. Vai definir senha no convite/recovery.
      const to = req.nextUrl.clone();
      to.pathname = "/update-password";
      return applyPendingCookies(NextResponse.redirect(to));
    }

    if (access_token && refresh_token) {
      // Se você enviar os tokens por querystring (convertidos no client)
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        const to = req.nextUrl.clone();
        to.pathname = "/login";
        to.searchParams.set("error", "set_session_failed");
        to.searchParams.set("error_description", error.message);
        return applyPendingCookies(NextResponse.redirect(to));
      }

      const to = req.nextUrl.clone();
      to.pathname = "/update-password";
      return applyPendingCookies(NextResponse.redirect(to));
    }

    // Se chegou aqui, faltou token/código
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("error", "missing_params");
    to.searchParams.set(
      "error_description",
      "Callback sem code/access_token. Abra o link do email novamente."
    );
    return applyPendingCookies(NextResponse.redirect(to));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro inesperado no callback.";
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("error", "callback_exception");
    to.searchParams.set("error_description", message);
    return applyPendingCookies(NextResponse.redirect(to));
  }
}
