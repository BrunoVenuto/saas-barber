import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

type CookieSet = {
  name: string;
  value: string;
  options: Parameters<ReturnType<typeof cookies>["set"]>[2];
};

type ServerClientBundle = {
  supabase: ReturnType<typeof createServerClient>;
  /**
   * Aplica cookies pendentes no response.
   * Use APENAS depois que você tiver certeza que a request é válida (ex: auth ok).
   */
  applyToResponse: (res: NextResponse) => NextResponse;
};

/**
 * ✅ SAFE SERVER CLIENT
 * - NÃO seta cookie automaticamente (evita "limpar sessão" quando request chega sem cookie)
 * - Acumula cookies em memória e você decide quando aplicar no response.
 */
export function createClient(): ServerClientBundle {
  const cookieStore = cookies();

  const pendingCookies: CookieSet[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars (URL/ANON_KEY).");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // 🚫 NUNCA aplicar direto aqui.
        // Apenas armazenar para o handler aplicar no response quando fizer sentido.
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({
            name,
            value,
            options: options ?? {},
          });
        });
      },
    },
  });

  function applyToResponse(res: NextResponse) {
    pendingCookies.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    return res;
  }

  return { supabase, applyToResponse };
}
