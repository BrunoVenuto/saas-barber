import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Tipagem compatível com o que o @supabase/ssr espera internamente (SerializeOptions)
// Note: sameSite pode ser boolean no tipo do cookie.
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

export async function middleware(req: NextRequest) {
  // Guardamos os cookies que o Supabase pedir para setar e aplicamos no response FINAL
  // (NextResponse.next OU NextResponse.redirect). Isso evita loop de login por perder Set-Cookie no redirect.
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (response: NextResponse) => {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set({ name, value, ...options });
    }
    return response;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @supabase/ssr espera uma lista de cookies do request
        getAll() {
          return req.cookies.getAll();
        },
        // @supabase/ssr envia uma lista de cookies para você aplicar no response
        setAll(cookies: SupabaseCookieToSet[]) {
          pendingCookies.push(...cookies);
        },
      },
    }
  );

  const pathname = req.nextUrl.pathname;

  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // Checa sessão/usuário
  const { data, error: authErr } = await supabase.auth.getUser();
  const user = data.user;

  // Protege rotas /admin e /barbeiro
  if ((isAdminRoute || isBarberRoute) && (authErr || !user)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // Fora das rotas protegidas (por segurança; matcher já limita)
  if (!isAdminRoute && !isBarberRoute) {
    return applyPendingCookies(NextResponse.next());
  }

  // Carrega profile
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user!.id)
    .single();

  if (profErr || !profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  /**
   * ✅ ADMIN ROUTES
   */
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // admin de barbearia NÃO pode acessar /admin/saas/*
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    return applyPendingCookies(NextResponse.next());
  }

  /**
   * ✅ BARBEIRO ROUTES (RECOMENDADO)
   * Agora permite:
   * - profile.role === "barber"
   * OU
   * - profile.role === "admin" MAS existe registro em public.barbers com profile_id = auth.uid()
   */
  if (isBarberRoute) {
    // barbeiro "puro"
    if (profile.role === "barber") {
      return applyPendingCookies(NextResponse.next());
    }

    // admin plataforma não deve entrar como barbeiro
    if (profile.role === "admin" && profile.barbershop_id === null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/saas/barbearias";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // admin de barbearia pode entrar como barbeiro SE existir barbers.profile_id = user.id
    const { data: barberRow, error: barberErr } = await supabase
      .from("barbers")
      .select("id")
      .eq("profile_id", user!.id)
      .maybeSingle();

    if (!barberErr && barberRow?.id) {
      return applyPendingCookies(NextResponse.next());
    }

    // não tem vínculo de barbeiro -> volta pro admin
    const url = req.nextUrl.clone();
    url.pathname = "/admin/agenda";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  return applyPendingCookies(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/barbeiro/:path*"],
};
