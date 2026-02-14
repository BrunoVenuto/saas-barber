import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pendingCookies) {
      res.cookies.set({ name: c.name, value: c.value, ...c.options });
    }
    return res;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  try {
    // AUTH
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Auth session missing!", step: "auth" },
        { status: 401 },
      );
    }

    // PERMISSÃO
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single<ProfileRow>();

    if (profErr || !profile) {
      return NextResponse.json(
        { error: "Profile not found", step: "profile" },
        { status: 403 },
      );
    }

    const isPlatformAdmin =
      profile.role === "admin" && profile.barbershop_id === null;

    if (!isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden", step: "permission" },
        { status: 403 },
      );
    }

    // BODY
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing fields", step: "validation" },
        { status: 400 },
      );
    }

    // SERVICE ROLE
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1️⃣ Criar barbearia
    const { data: shop, error: shopErr } = await admin
      .from("barbershops")
      .insert({ name })
      .select("id")
      .single();

    if (shopErr || !shop) {
      return NextResponse.json(
        {
          error: shopErr?.message ?? "Shop insert failed",
          step: "shop_insert",
        },
        { status: 400 },
      );
    }

    // 2️⃣ Criar usuário no Auth
    const { data: newUser, error: userErr } = await admin.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
      },
    );

    if (userErr || !newUser.user) {
      return NextResponse.json(
        {
          error: userErr?.message ?? "User create failed",
          step: "auth_create",
        },
        { status: 400 },
      );
    }

    // 3️⃣ Criar profile
    const { error: profileErr } = await admin.from("profiles").insert({
      id: newUser.user.id,
      role: "admin",
      barbershop_id: shop.id,
    });

    if (profileErr) {
      return NextResponse.json(
        { error: profileErr.message, step: "profile_insert" },
        { status: 400 },
      );
    }

    return applyPendingCookies(
      NextResponse.json({ ok: true, barbershopId: shop.id }),
    );
  } catch {
    return NextResponse.json(
      { error: "Internal error", step: "catch" },
      { status: 500 },
    );
  }

}
