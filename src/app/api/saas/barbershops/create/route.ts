import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

type CreateBody = {
  name?: unknown;
  slug?: unknown;
  adminEmail?: unknown;
  adminName?: unknown;
  adminPassword?: unknown;
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedClient();

    // 0) auth
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.error("[SAAS_CREATE] auth error:", authErr);
      return NextResponse.json(
        { error: authErr.message, step: "auth" },
        { status: 401 },
      );
    }
    if (!authData?.user) {
      return NextResponse.json(
        { error: "Não autenticado.", step: "auth" },
        { status: 401 },
      );
    }

    // 1) profile + permissão
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", authData.user.id)
      .single();

    if (profErr) {
      console.error("[SAAS_CREATE] profile error:", profErr);
      return NextResponse.json(
        { error: profErr.message, step: "profile" },
        { status: 404 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Perfil não encontrado.", step: "profile" },
        { status: 404 },
      );
    }

    // ✅ precisa ser admin plataforma (role admin + barbershop_id null)
    if (profile.role !== "admin" || profile.barbershop_id !== null) {
      return NextResponse.json(
        {
          error: "Sem permissão (apenas admin plataforma).",
          step: "permission",
        },
        { status: 403 },
      );
    }

    // 2) body
    const body = (await req.json().catch(() => null)) as CreateBody | null;

    const name = asTrimmedString(body?.name);
    const slugRaw = asTrimmedString(body?.slug);
    const adminEmail = asTrimmedString(body?.adminEmail);
    const adminName = asTrimmedString(body?.adminName);
    const adminPassword = asTrimmedString(body?.adminPassword);

    if (!name) {
      return NextResponse.json(
        { error: "Informe o nome.", step: "body" },
        { status: 400 },
      );
    }

    if (!adminEmail) {
      return NextResponse.json(
        { error: "Informe o email do admin.", step: "body" },
        { status: 400 },
      );
    }

    // ✅ senha definida pelo admin SaaS
    if (!adminPassword) {
      return NextResponse.json(
        { error: "Informe a senha do admin da barbearia.", step: "body" },
        { status: 400 },
      );
    }

    if (adminPassword.length < 6) {
      return NextResponse.json(
        { error: "Senha fraca. Use pelo menos 6 caracteres.", step: "body" },
        { status: 400 },
      );
    }

    const slug = slugRaw ? slugify(slugRaw) : slugify(name);
    if (!slug) {
      return NextResponse.json(
        { error: "Slug inválido.", step: "slug" },
        { status: 400 },
      );
    }

    // 3) service client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      console.error("[SAAS_CREATE] missing env", {
        url: !!url,
        serviceKey: !!serviceKey,
      });
      return NextResponse.json(
        {
          error:
            "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
          step: "env",
        },
        { status: 500 },
      );
    }

    const adminSupabase = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 4) evitar slug duplicado
    const { data: existing, error: existsErr } = await adminSupabase
      .from("barbershops")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existsErr) {
      console.error("[SAAS_CREATE] slug check error:", existsErr);
      return NextResponse.json(
        { error: existsErr.message, step: "slug_check" },
        { status: 400 },
      );
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          error: `Slug já existe: ${slug}. Troque o slug.`,
          step: "slug_check",
        },
        { status: 409 },
      );
    }

    // 5) cria barbearia
    const { data: shop, error: shopErr } = await adminSupabase
      .from("barbershops")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();

    if (shopErr) {
      console.error("[SAAS_CREATE] shop insert error:", shopErr);
      return NextResponse.json(
        { error: shopErr.message, step: "shop_insert" },
        { status: 400 },
      );
    }

    // 6) cria usuário do admin da barbearia (com senha definida)
    const { data: created, error: createErr } =
      await adminSupabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          role: "admin",
          barbershop_id: shop.id,
          name: adminName ?? null,
        },
      });

    if (createErr) {
      console.error("[SAAS_CREATE] create user error:", createErr);
      return NextResponse.json(
        {
          error: `Barbearia criada, mas falhou criar usuário: ${createErr.message}`,
          step: "create_user",
        },
        { status: 400 },
      );
    }

    const createdUserId = created?.user?.id;
    if (!createdUserId) {
      return NextResponse.json(
        {
          error: "Usuário criado, mas não consegui pegar o ID.",
          step: "create_user",
        },
        { status: 400 },
      );
    }

    // 7) upsert profile do admin da barbearia (SERVICE ROLE ignora RLS)
    const { error: upsertErr } = await adminSupabase.from("profiles").upsert(
      {
        id: createdUserId,
        role: "admin",
        barbershop_id: shop.id,
        name: adminName ?? adminEmail,
      },
      { onConflict: "id" },
    );

    if (upsertErr) {
      console.error("[SAAS_CREATE] profile upsert error:", upsertErr);
      return NextResponse.json(
        {
          error: `Usuário ok, mas falhou criar profile: ${upsertErr.message}`,
          step: "profile_upsert",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      shop,
      created_admin_email: adminEmail,
      created_with_password: true,
    });
  } catch (e: unknown) {
    console.error("[SAAS_CREATE] unhandled error:", e);
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { error: message, step: "catch" },
      { status: 500 },
    );
  }
}
