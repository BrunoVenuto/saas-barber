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

  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname =
        profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return applyPendingCookies(NextResponse.redirect(url));
    }

    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return applyPendingCookies(NextResponse.redirect(url));
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
