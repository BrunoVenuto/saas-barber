import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type ProfileRow = {
  role: string;
  barbershop_id: string | null;
};

export async function middleware(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ✅ READ-ONLY: só lê cookies. NÃO seta cookies no response.
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // NÃO FAZ NADA de propósito (evita apagar cookie no refresh)
        },
      },
    },
  );

  const pathname = req.nextUrl.pathname;

  const isApiRoute = pathname.startsWith("/api");
  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // ✅ /api: nunca redireciona, não mexe em cookies
  if (isApiRoute) return NextResponse.next();

  // Rotas públicas
  if (!isAdminRoute && !isBarberRoute) return NextResponse.next();

  // Protegidas: exige sessão
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // =========================
  // ADMIN ROUTES (/admin)
  // =========================
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname =
        profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // =========================
  // BARBER ROUTES (/barbeiro)
  // =========================
  if (isBarberRoute) {
    if (profile.role === "barber") return NextResponse.next();

    if (profile.role === "admin") {
      const { data: barberRow } = await supabase
        .from("barbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle<{ id: string }>();

      if (barberRow?.id) return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/admin/agenda";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
