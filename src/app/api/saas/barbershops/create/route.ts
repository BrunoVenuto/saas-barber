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

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

type BarbershopRow = {
  id: string;
  name: string;
  slug: string;
};

export async function POST(req: Request) {
  try {
    const supabase = createAuthedClient();

    // 1) Auth
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
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

    // 2) Checa permissão: admin da plataforma (role=admin e barbershop_id = null)
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", authData.user.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json(
        {
          error: profErr?.message ?? "Perfil não encontrado.",
          step: "profile",
        },
        { status: 403 },
      );
    }

    const profRow = profile as ProfileRow;
    if (profRow.role !== "admin" || profRow.barbershop_id !== null) {
      return NextResponse.json(
        {
          error: "Sem permissão (apenas admin plataforma).",
          step: "permission",
        },
        { status: 403 },
      );
    }

    // 3) Body
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

    // 4) Service client (para criar user e upsert profile ignorando RLS)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
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

    // 5) Evita slug duplicado
    const { data: existing, error: existsErr } = await adminSupabase
      .from("barbershops")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existsErr) {
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

    // 6) Cria barbearia
    const { data: shop, error: shopErr } = await adminSupabase
      .from("barbershops")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();

    if (shopErr || !shop) {
      return NextResponse.json(
        {
          error: shopErr?.message ?? "Falha ao criar barbearia.",
          step: "shop_insert",
        },
        { status: 400 },
      );
    }

    const shopRow = shop as BarbershopRow;

    // 7) Cria usuário já com senha definida (email confirmado)
    const { data: created, error: createErr } =
      await adminSupabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          role: "admin",
          barbershop_id: shopRow.id,
          name: adminName ?? null,
        },
      });

    if (createErr) {
      return NextResponse.json(
        {
          error:
            "Barbearia criada, mas falhou criar usuário: " + createErr.message,
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

    // 8) Upsert profile do admin da barbearia
    const { error: upsertErr } = await adminSupabase.from("profiles").upsert(
      {
        id: createdUserId,
        role: "admin",
        barbershop_id: shopRow.id,
        name: adminName ?? adminEmail,
      },
      { onConflict: "id" },
    );

    if (upsertErr) {
      return NextResponse.json(
        {
          error: "Usuário ok, mas falhou criar profile: " + upsertErr.message,
          step: "profile_upsert",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      shop: { id: shopRow.id, name: shopRow.name, slug: shopRow.slug },
      created_admin_email: adminEmail,
      created_with_password: true,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { error: message, step: "catch" },
      { status: 500 },
    );
  }
}
