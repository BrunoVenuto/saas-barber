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

export async function POST(req: Request) {
  try {
    const supabase = createAuthedClient();

    // 0) auth
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.error("[SAAS_CREATE] auth error:", authErr);
      return NextResponse.json({ error: authErr.message, step: "auth" }, { status: 401 });
    }
    if (!authData?.user) {
      return NextResponse.json({ error: "Não autenticado.", step: "auth" }, { status: 401 });
    }

    // 1) profile + permissão
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", authData.user.id)
      .single();

    if (profErr) {
      console.error("[SAAS_CREATE] profile error:", profErr);
      return NextResponse.json({ error: profErr.message, step: "profile" }, { status: 404 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado.", step: "profile" }, { status: 404 });
    }

    // ✅ precisa ser admin plataforma (role admin + barbershop_id null)
    if (profile.role !== "admin" || profile.barbershop_id !== null) {
      return NextResponse.json(
        { error: "Sem permissão (apenas admin plataforma).", step: "permission" },
        { status: 403 }
      );
    }

    // 2) body
    const body = await req.json().catch(() => null);

    const name: string = body?.name?.trim();
    const slugRaw: string | undefined = body?.slug?.trim();
    const adminEmail: string = body?.adminEmail?.trim();
    const adminName: string | undefined = body?.adminName?.trim();

    if (!name) return NextResponse.json({ error: "Informe o nome.", step: "body" }, { status: 400 });
    if (!adminEmail)
      return NextResponse.json({ error: "Informe o email do admin.", step: "body" }, { status: 400 });

    const slug = slugRaw ? slugify(slugRaw) : slugify(name);
    if (!slug) return NextResponse.json({ error: "Slug inválido.", step: "slug" }, { status: 400 });

    // 3) service client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      console.error("[SAAS_CREATE] missing env", { url: !!url, serviceKey: !!serviceKey });
      return NextResponse.json(
        {
          error: "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
          step: "env",
        },
        { status: 500 }
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
      return NextResponse.json({ error: existsErr.message, step: "slug_check" }, { status: 400 });
    }

    if (existing?.id) {
      return NextResponse.json(
        { error: `Slug já existe: ${slug}. Troque o slug.`, step: "slug_check" },
        { status: 409 }
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
      return NextResponse.json({ error: shopErr.message, step: "shop_insert" }, { status: 400 });
    }

    // ✅✅✅ 6) convida admin - redirectTo TEM QUE IR PRA /callback
    // porque o link vem com #access_token e quem cria sessão é o callback/page.tsx
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!appUrl) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)", step: "env_app_url" },
        { status: 500 }
      );
    }

    const redirectTo = `${appUrl}/callback`;

    const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
      adminEmail,
      {
        redirectTo,
        data: {
          role: "admin",
          barbershop_id: shop.id,
          name: adminName || null,
        },
      }
    );

    if (inviteErr) {
      console.error("[SAAS_CREATE] invite error:", inviteErr);
      return NextResponse.json(
        { error: `Barbearia criada, mas falhou convite: ${inviteErr.message}`, step: "invite" },
        { status: 400 }
      );
    }

    const invitedUserId = invited?.user?.id;
    if (!invitedUserId) {
      console.error("[SAAS_CREATE] invited user id missing:", invited);
      return NextResponse.json(
        { error: "Convite enviado, mas não consegui pegar o ID do usuário.", step: "invite" },
        { status: 400 }
      );
    }

    // 7) upsert profile do admin da barbearia (SERVICE ROLE ignora RLS)
    const { error: upsertErr } = await adminSupabase.from("profiles").upsert(
      {
        id: invitedUserId,
        role: "admin",
        barbershop_id: shop.id,
        name: adminName || adminEmail,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      console.error("[SAAS_CREATE] profile upsert error:", upsertErr);
      return NextResponse.json(
        { error: `Convite ok, mas falhou criar profile: ${upsertErr.message}`, step: "profile_upsert" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      shop,
      invited_admin_email: adminEmail,
      redirectTo,
    });
  } catch (e: unknown) {
    console.error("[SAAS_CREATE] unhandled error:", e);

    const message = e instanceof Error ? e.message : "Erro inesperado.";

    return NextResponse.json({ error: message, step: "catch" }, { status: 500 });
  }
}
