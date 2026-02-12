import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  // 1) Validar admin logado (cookies)
  const supabase = createAuthedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, barbershop_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.barbershop_id !== null) {
    return NextResponse.json(
      { error: "Sem permissão. Este endpoint é do admin da plataforma (admin com barbershop_id NULL)." },
      { status: 403 }
    );
  }

  // 2) Ler payload
  const body = await req.json().catch(() => null);
  const name: string = body?.name?.trim();
  const slugRaw: string | undefined = body?.slug?.trim();
  const adminEmail: string = body?.adminEmail?.trim();
  const adminName: string | undefined = body?.adminName?.trim();

  if (!name) {
    return NextResponse.json({ error: "Informe o nome da barbearia." }, { status: 400 });
  }
  if (!adminEmail) {
    return NextResponse.json({ error: "Informe o email do admin da barbearia." }, { status: 400 });
  }

  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  // 3) Service client (Service Role)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "Env faltando: SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL." },
      { status: 500 }
    );
  }

  const adminSupabase = createServiceClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 4) Criar barbearia
  const { data: shop, error: shopErr } = await adminSupabase
    .from("barbershops")
    .insert({
      name,
      slug,
      headline: body?.headline ?? null,
      subheadline: body?.subheadline ?? null,
      phone: body?.phone ?? null,
      address: body?.address ?? null,
      instagram: body?.instagram ?? null,
      hero_image_url: body?.hero_image_url ?? null,
    })
    .select("id, name, slug")
    .single();

  if (shopErr) {
    return NextResponse.json({ error: shopErr.message }, { status: 400 });
  }

  // 5) Convidar/criar usuário admin da barbearia
  const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
    adminEmail,
    {
      redirectTo: `${new URL(req.url).origin}/update-password`,
      data: {
        role: "admin",
        barbershop_id: shop.id,
        name: adminName || null,
      },
    }
  );

  if (inviteErr) {
    return NextResponse.json(
      { error: `Barbearia criada, mas falhou convite do admin: ${inviteErr.message}` },
      { status: 400 }
    );
  }

  const invitedUserId = invited?.user?.id;
  if (!invitedUserId) {
    return NextResponse.json(
      { error: "Barbearia criada, mas não foi possível obter ID do usuário convidado." },
      { status: 400 }
    );
  }

  // 6) Criar/atualizar profile do admin da barbearia
  // (assume profiles.id = auth.users.id)
  const { error: profErr } = await adminSupabase.from("profiles").upsert(
    {
      id: invitedUserId,
      role: "admin",
      barbershop_id: shop.id,
      name: adminName || adminEmail,
    },
    { onConflict: "id" }
  );

  if (profErr) {
    return NextResponse.json(
      { error: `Barbearia criada e convite enviado, mas falhou criar profile: ${profErr.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    shop,
    invited_admin_email: adminEmail,
  });
}
