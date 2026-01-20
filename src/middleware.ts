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
  const res = NextResponse.next();

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
          cookies.forEach(({ name, value, options }) => {
            // forma mais compatível com Next: objeto com name/value e options espalhadas
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const pathname = req.nextUrl.pathname;

  const isAdminRoute = pathname.startsWith("/admin");
  const isSaasRoute = pathname.startsWith("/admin/saas");
  const isBarberRoute = pathname.startsWith("/barbeiro");

  if ((isAdminRoute || isBarberRoute) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!isAdminRoute && !isBarberRoute) {
    return res;
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", user!.id)
    .single();

  if (profErr || !profile) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAdminRoute) {
    if (profile.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = profile.role === "barber" ? "/barbeiro/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    if (isSaasRoute && profile.barbershop_id !== null) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/agenda";
      return NextResponse.redirect(url);
    }

    return res;
  }

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
  matcher: ["/admin/:path*", "/barbeiro/:path*"],
};
