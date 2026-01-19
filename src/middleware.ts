import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const pathname = req.nextUrl.pathname;

  // rotas publicas
  const isPublic =
    pathname.startsWith("/agendar") ||
    pathname.startsWith("/b") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/");

  // Obs: "/" é pública, mas vamos tratar melhor pelo matcher (abaixo)
  // aqui não fazemos nada.

  // Rotas protegidas
  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // Se for rota protegida e não logado -> login
  if ((isAdminRoute || isBarberRoute) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Se não é protegido, segue
  if (!isAdminRoute && !isBarberRoute) {
    return res;
  }

  // Buscar profile para decisões
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user!.id)
    .single();

  if (profErr || !profile) {
    // se não tiver profile, manda pro login (ou uma tela de erro)
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ======================
  // /admin/*
  // ======================
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      // Se não é admin -> manda pro dashboard correto
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    // /admin/saas/* é apenas admin plataforma (barbershop_id null)
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda"; // admin de barbearia
      return NextResponse.redirect(url);
    }

    return res;
  }

  // ======================
  // /barbeiro/*
  // ======================
  if (isBarberRoute) {
    if (profile.role !== "barber") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return NextResponse.redirect(url);
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    // só protege esses caminhos
    "/admin/:path*",
    "/barbeiro/:path*",
  ],
};
