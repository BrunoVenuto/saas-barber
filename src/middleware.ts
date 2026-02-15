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

  // ✅ API: nunca redireciona; só faz refresh de cookie se a request já tinha sb-
  if (isApiRoute) {
    const hadSbCookie = req.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-"));

    await supabase.auth.getUser();

    const res = NextResponse.next();
    return hadSbCookie ? applyPendingCookies(res) : res;
  }

  // Rotas públicas: não exige auth
  if (!isAdminRoute && !isBarberRoute) {
    return applyPendingCookies(NextResponse.next());
  }

  // ✅ CRÍTICO: se getUser falhar, NÃO aplique cookies (senão ele apaga a sessão no refresh)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData.user;

  if (authErr || !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url); // 🚫 sem applyPendingCookies
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
    return NextResponse.redirect(url); // 🚫 sem applyPendingCookies
  }

  // =========================
  // ADMIN ROUTES (/admin)
  // =========================
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname =
        profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return NextResponse.redirect(url); // 🚫 sem applyPendingCookies
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
    if (profile.role === "barber") {
      return applyPendingCookies(NextResponse.next());
    }

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

    const url = req.nextUrl.clone();
    url.pathname = "/admin/agenda";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  return applyPendingCookies(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
