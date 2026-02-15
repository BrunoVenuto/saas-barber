import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type CreateBody = {
  name?: unknown;
  slug?: unknown;
  adminEmail?: unknown;
  adminName?: unknown;

  headline?: unknown;
  subheadline?: unknown;
  phone?: unknown;
  address?: unknown;
  instagram?: unknown;
  hero_image_url?: unknown;
};

type ProfileRow = {
  id: string;
  role: string | null;
  barbershop_id: string | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function getTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function POST(req: Request) {
  // 1) Validar admin logado (cookies)
  const { supabase, applyToResponse } = createAuthedClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  // 🚫 não aplica cookies aqui
  if (userErr || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, barbershop_id")
    .eq("id", user.id)
    .single();

  const profile = data as ProfileRow | null;


  if (profileErr || !profile) {
    const res = NextResponse.json(
      { error: "Profile não encontrado." },
      { status: 404 },
    );
    return applyToResponse(res);
  }

  if (profile.role !== "admin" || profile.barbershop_id !== null) {
    const res = NextResponse.json(
      {
        error:
          "Sem permissão. Este endpoint é do admin da plataforma (admin com barbershop_id NULL).",
      },
      { status: 403 },
    );
    return applyToResponse(res);
  }

  // 2) Ler payload (sem any)
  const raw: unknown = await req.json().catch(() => null);
  const body: CreateBody =
    raw && typeof raw === "object" && raw !== null ? (raw as CreateBody) : {};

  const name = getTrimmedString(body.name);
  const slugRaw = getTrimmedString(body.slug);
  const adminEmail = getTrimmedString(body.adminEmail);
  const adminName = getTrimmedString(body.adminName);

  if (!name) {
    const res = NextResponse.json(
      { error: "Informe o nome da barbearia." },
      { status: 400 },
    );
    return applyToResponse(res);
  }
  if (!adminEmail) {
    const res = NextResponse.json(
      { error: "Informe o email do admin da barbearia." },
      { status: 400 },
    );
    return applyToResponse(res);
  }

  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) {
    const res = NextResponse.json({ error: "Slug inválido." }, { status: 400 });
    return applyToResponse(res);
  }

  // 3) Service client (Service Role)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !url) {
    const res = NextResponse.json(
      {
        error:
          "Env faltando: SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL.",
      },
      { status: 500 },
    );
    return applyToResponse(res);
  }

  const adminSupabase = createServiceClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Helpers pra campos opcionais
  const headline = getTrimmedString(body.headline);
  const subheadline = getTrimmedString(body.subheadline);
  const phone = getTrimmedString(body.phone);
  const address = getTrimmedString(body.address);
  const instagram = getTrimmedString(body.instagram);
  const hero_image_url = getTrimmedString(body.hero_image_url);

  // 4) Criar barbearia
  const { data: shop, error: shopErr } = await adminSupabase
    .from("barbershops")
    .insert({
      name,
      slug,
      headline: headline ?? null,
      subheadline: subheadline ?? null,
      phone: phone ?? null,
      address: address ?? null,
      instagram: instagram ?? null,
      hero_image_url: hero_image_url ?? null,
    })
    .select("id, name, slug")
    .single<{ id: string; name: string; slug: string }>();

  if (shopErr || !shop) {
    const res = NextResponse.json(
      { error: shopErr?.message ?? "Falha ao criar barbearia." },
      { status: 400 },
    );
    return applyToResponse(res);
  }

  // 5) Convidar/criar usuário admin da barbearia
  const origin = new URL(req.url).origin;

  const { data: invited, error: inviteErr } =
    await adminSupabase.auth.admin.inviteUserByEmail(adminEmail, {
      redirectTo: `${origin}/update-password`,
      data: {
        role: "admin",
        barbershop_id: shop.id,
        name: adminName ?? null,
      },
    });

  if (inviteErr) {
    const res = NextResponse.json(
      {
        error: `Barbearia criada, mas falhou convite do admin: ${inviteErr.message}`,
      },
      { status: 400 },
    );
    return applyToResponse(res);
  }

  const invitedUserId = invited?.user?.id ?? null;
  if (!invitedUserId) {
    const res = NextResponse.json(
      {
        error:
          "Barbearia criada, mas não foi possível obter ID do usuário convidado.",
      },
      { status: 400 },
    );
    return applyToResponse(res);
  }

  // 6) Criar/atualizar profile do admin da barbearia (profiles.id = auth.users.id)
  const { error: profErr } = await adminSupabase.from("profiles").upsert(
    {
      id: invitedUserId,
      role: "admin",
      barbershop_id: shop.id,
      name: adminName ?? adminEmail,
    },
    { onConflict: "id" },
  );

  if (profErr) {
    const res = NextResponse.json(
      {
        error: `Barbearia criada e convite enviado, mas falhou criar profile: ${profErr.message}`,
      },
      { status: 400 },
    );
    return applyToResponse(res);
  }

  // ✅ OK: aplica cookies pendentes só no final
  const res = NextResponse.json({
    ok: true,
    shop,
    invited_admin_email: adminEmail,
  });
  return applyToResponse(res);
}
