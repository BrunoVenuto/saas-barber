import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Tipagem compatível com o que o @supabase/ssr espera internamente (SerializeOptions)
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
  // Guardamos cookies pendentes e aplicamos no response FINAL (next/redirect)
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({ name, value, ...options });
    });
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
    }
  );

  const pathname = req.nextUrl.pathname;

  // Rotas
  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  // ✅ ROTA DO CONVIDADO CRIAR SENHA
  const isUpdatePasswordRoute = pathname === "/update-password";

  // 1) Checa sessão/usuário (sempre que rota é protegida)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData.user;

  // ✅ /update-password precisa APENAS estar logado (não exige role/profile)
  if (isUpdatePasswordRoute) {
    if (authErr || !user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return applyPendingCookies(NextResponse.redirect(url));
    }
    return applyPendingCookies(NextResponse.next());
  }

  // 2) Protege /admin e /barbeiro
  if ((isAdminRoute || isBarberRoute) && (authErr || !user)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // Fora das rotas protegidas (matcher já limita, mas mantendo por segurança)
  if (!isAdminRoute && !isBarberRoute) {
    return applyPendingCookies(NextResponse.next());
  }

  // 3) Pega profile (role/barbershop_id)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user!.id)
    .single();

  // Se não tem profile ainda, manda pro login (ou você pode mandar pro /update-password)
  if (profErr || !profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return applyPendingCookies(NextResponse.redirect(url));
  }

  // 4) Regras de acesso por role
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    // ✅ se for admin de barbearia (barbershop_id != null) não pode ver /admin/saas
    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    return applyPendingCookies(NextResponse.next());
  }

  if (isBarberRoute) {
    if (profile.role !== "barber") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return applyPendingCookies(NextResponse.redirect(url));
    }
    return applyPendingCookies(NextResponse.next());
  }

  return applyPendingCookies(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/barbeiro/:path*", "/update-password"],
};
