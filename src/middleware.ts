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
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({ name, value, ...options });
    });
    return response;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Se faltar env, não trava o app com redirect infinito
    return applyPendingCookies(NextResponse.next());
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies: SupabaseCookieToSet[]) {
        pendingCookies.push(...cookies);
      },
    },
  });

  const pathname = req.nextUrl.pathname;

  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // Checa sessão/usuário
  const { data, error: authErr } = await supabase.auth.getUser();
  const user = data.user;

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

  // ✅ allowlist de rotas liberadas durante onboarding (PASSO 2/3/4)
  const isOnboardingRoute = pathname.startsWith("/admin/onboarding");

  // ⚠️ IMPORTANTE: usar ARRAY (não Set) pra evitar erro TS2802 com target antigo
  const onboardingAllowedAdminRoutes: string[] = [
    "/admin/onboarding",
    "/admin/servicos",
    "/admin/barbeiros",
    "/admin/horarios",
    "/admin/minha-barbearia",
  ];

  // helper: considera /admin/servicos/* etc também
  const isAllowedDuringOnboarding = (() => {
    for (const base of onboardingAllowedAdminRoutes) {
      if (pathname === base) return true;
      if (pathname.startsWith(base + "/")) return true;
    }
    return false;
  })();

  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // admin cliente (barbershop_id != null) não pode acessar /admin/saas/*
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // ✅ Gate de onboarding: enquanto não finalizar, só deixa as rotas allowlist
    // (apenas para admin de barbearia: barbershop_id != null)
    if (profile.barbershop_id !== null) {
      const { data: shop } = await supabase
        .from("barbershops")
        .select("onboarded_at")
        .eq("id", profile.barbershop_id)
        .maybeSingle();

      const isOnboarded = !!shop?.onboarded_at;

      if (!isOnboarded && !isAllowedDuringOnboarding) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/onboarding";
        return applyPendingCookies(NextResponse.redirect(url));
      }

      // Se já onboarded e tentar acessar /admin/onboarding, joga pro dashboard
      if (isOnboarded && isOnboardingRoute) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return applyPendingCookies(NextResponse.redirect(url));
      }
    }

    return applyPendingCookies(NextResponse.next());
  }

  if (isBarberRoute) {
    if (profile.role !== "barber") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
    }
    return applyPendingCookies(NextResponse.next());
  }

  return applyPendingCookies(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/barbeiro/:path*"],
};
