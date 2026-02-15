import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type ProfileRow = {
  role: "admin" | "barber" | string;
  barbershop_id: string | null;
};

type BarberIdRow = { id: string };

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // (Com matcher restrito, isso é redundante, mas não atrapalha)
  if (!isAdminRoute && !isBarberRoute) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Falha “segura” sem mexer em cookies
    return NextResponse.next();
  }

  const supabase = createServerClient(url, anon, {
    // ✅ READ-ONLY: só lê cookies. NÃO seta cookies no response.
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // NOOP proposital
      },
    },
  });

  // Protegidas: exige sessão
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // =========================
  // ADMIN ROUTES (/admin)
  // =========================
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname =
        profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (isSaasRoute && profile.barbershop_id !== null) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/admin/agenda";
      return NextResponse.redirect(redirectUrl);
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
        .maybeSingle<BarberIdRow>();

      if (barberRow?.id) return NextResponse.next();
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/admin/agenda";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  // ✅ Roda SÓ onde precisa (mais estável)
  matcher: ["/admin/:path*", "/barbeiro/:path*"],
};
