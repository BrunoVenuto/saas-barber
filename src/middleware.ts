import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (response: NextResponse) => {
    for (const c of pendingCookies) {
      response.cookies.set({ name: c.name, value: c.value, ...c.options });
    }
    return response;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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

  // 1) precisa estar logado para /admin/* e /barbeiro/*
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if ((isAdminRoute || isBarberRoute) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // fora das rotas protegidas (matcher já limita, mas fica seguro)
  if (!isAdminRoute && !isBarberRoute) {
    return applyPendingCookies(NextResponse.next());
  }

  // 2) pega o profile do user
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user!.id)
    .single();

  if (!profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // 3) Regras /admin/*
  if (isAdminRoute) {
    // só admin entra no /admin/*
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // admin de barbearia não pode ver /admin/saas/*
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // ✅ Gate de onboarding (somente admin de barbearia)
    if (profile.barbershop_id !== null) {
      const { data: shop } = await supabase
        .from("barbershops")
        .select("onboarded_at")
        .eq("id", profile.barbershop_id)
        .maybeSingle();

      const isOnboarded = !!shop?.onboarded_at;

      // ✅ rotas liberadas enquanto não finalizou onboarding
      // (ARRAY para não dar erro TS2802)
      const allowedDuringOnboarding: string[] = [
        "/admin/onboarding",
        "/admin/servicos",
        "/admin/barbeiros",
        "/admin/horarios",
        "/admin/minha-barbearia",
        "/admin/agenda",
        "/admin/dashboard",
      ];

      const isAllowed = (() => {
        for (const base of allowedDuringOnboarding) {
          if (pathname === base) return true;
          if (pathname.startsWith(base + "/")) return true;
        }
        return false;
      })();

      // se não onboarded e tentar ir pra qualquer coisa fora da allowlist -> volta onboarding
      if (!isOnboarded && !isAllowed) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/onboarding";
        return applyPendingCookies(NextResponse.redirect(url));
      }

      // se já onboarded e tentar acessar onboarding -> manda pro dashboard
      if (isOnboarded && pathname.startsWith("/admin/onboarding")) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return applyPendingCookies(NextResponse.redirect(url));
      }
    }

    return applyPendingCookies(NextResponse.next());
  }

  // 4) Regras /barbeiro/*
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
