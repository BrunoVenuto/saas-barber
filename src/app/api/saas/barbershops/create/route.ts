import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type PostgrestError } from "@supabase/supabase-js";

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

type CreateBody = {
  name?: string;
  slug?: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
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
          return cookieStore
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  try {
    // AUTH (não aplica cookies no 401 para não "limpar" sessão)
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Auth session missing!", step: "auth" },
        { status: 401 },
      );
    }

    // PERMISSÃO (admin plataforma)
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

    // BODY (compatível com seu front)
    const body = (await req.json().catch(() => null)) as CreateBody | null;

    const name = body?.name?.trim() ?? "";
    const slug = (body?.slug ?? "").trim() || null;
    const adminEmail = body?.adminEmail?.trim() ?? "";
    const adminName = (body?.adminName ?? "").trim() || null;
    const adminPassword = body?.adminPassword?.trim() ?? "";

    if (!name) {
      return NextResponse.json(
        {
          error: "Missing fields",
          step: "validation",
          details: { field: "name" },
        },
        { status: 400 },
      );
    }
    if (!adminEmail) {
      return NextResponse.json(
        {
          error: "Missing fields",
          step: "validation",
          details: { field: "adminEmail" },
        },
        { status: 400 },
      );
    }
    if (!adminPassword) {
      return NextResponse.json(
        {
          error: "Missing fields",
          step: "validation",
          details: { field: "adminPassword" },
        },
        { status: 400 },
      );
    }
    if (adminPassword.length < 6) {
      return NextResponse.json(
        {
          error: "Weak password",
          step: "validation",
          details: { field: "adminPassword" },
        },
        { status: 400 },
      );
    }

    // SERVICE ROLE
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing env", step: "env" },
        { status: 500 },
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) criar barbearia
    const { data: shop, error: shopErr } = await admin
      .from("barbershops")
      .insert({ name, slug })
      .select("id,name,slug")
      .single();

    if (shopErr || !shop) {
      const err = shopErr as PostgrestError | null;
      return NextResponse.json(
        {
          error: err?.message ?? "Shop insert failed",
          step: "shop_insert",
          details: err?.code ?? null,
        },
        { status: 400 },
      );
    }

    // 2) criar user no auth
    const { data: created, error: userErr } = await admin.auth.admin.createUser(
      {
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: adminName ? { name: adminName } : undefined,
      },
    );

    if (userErr || !created.user) {
      return NextResponse.json(
        {
          error: userErr?.message ?? "User create failed",
          step: "auth_create",
        },
        { status: 400 },
      );
    }

    // 3) criar profile
    const { error: profileErr2 } = await admin.from("profiles").insert({
      id: created.user.id,
      role: "admin",
      barbershop_id: shop.id,
      ...(adminName ? { name: adminName } : {}),
    });

    if (profileErr2) {
      const err = profileErr2 as PostgrestError;
      return NextResponse.json(
        {
          error: err.message,
          step: "profile_insert",
          details: err.code ?? null,
        },
        { status: 400 },
      );
    }

    return applyPendingCookies(
      NextResponse.json({
        ok: true,
        shop,
        created_admin_email: adminEmail,
      }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal error", step: "catch", details: message },
      { status: 500 },
    );
  }
}
