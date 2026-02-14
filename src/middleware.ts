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

type ProfileRow = {
  role: string;
  barbershop_id: string | null;
};

export async function middleware(req: NextRequest) {
  // Cookies que o Supabase pedir para setar (aplicamos no response final)
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (response: NextResponse) => {
    for (const c of pendingCookies) {
      response.cookies.set({ name: c.name, value: c.value, ...c.options });
    }
    return response;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies: SupabaseCookieToSet[]) {
          pendingCookies.push(...cookies);
        },
      },
    },
  );

  const pathname = req.nextUrl.pathname;

  const isApiRoute = pathname.startsWith("/api");
  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  /**
   * ✅ IMPORTANTE:
   * Para rotas /api, a gente NÃO redireciona.
   * A gente só força o supabase.auth.getUser() para permitir refresh de cookies,
   * e deixa o próprio route handler devolver 401/403/409/etc em JSON.
   */
  if (isApiRoute) {
    await supabase.auth.getUser(); // força refresh se necessário
    return applyPendingCookies(NextResponse.next());
  }

  // Se não for rota protegida, segue
  if (!isAdminRoute && !isBarberRoute) {
    return applyPendingCookies(NextResponse.next());
  }

  // Checa sessão/usuário
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData.user;

  if (authErr || !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // Carrega perfil
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (profErr || !profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // =========================
  // ADMIN ROUTES (/admin)
  // =========================
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname =
        profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // Admin SaaS somente quando barbershop_id = null
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    return applyPendingCookies(NextResponse.next());
  }

  // =========================
  // BARBER ROUTES (/barbeiro)
  // =========================
  if (isBarberRoute) {
    // Caso 1: perfil já é barber -> ok
    if (profile.role === "barber") {
      return applyPendingCookies(NextResponse.next());
    }

    // Caso 2 (RECOMENDADO): dono/admin também atende
    // Se for admin e existir barbers.profile_id = auth.uid(), permite entrar
    if (profile.role === "admin") {
      const { data: barberRow, error: barberErr } = await supabase
        .from("barbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle<{ id: string }>();

      if (!barberErr && barberRow?.id) {
        return applyPendingCookies(NextResponse.next());
      }
    }

    // Caso contrário, não tem permissão de barbeiro
    const url = req.nextUrl.clone();
    url.pathname = "/admin/agenda";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  return applyPendingCookies(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/barbeiro/:path*", "/api/:path*"],
};
