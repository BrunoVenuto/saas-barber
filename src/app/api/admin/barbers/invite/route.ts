import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

type InviteBody = {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
};

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

export async function POST(req: Request) {
  try {
    // 1) Autenticado (cookie) - quem chama é o admin da barbearia logado
    const supabase = createAuthedClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 2) Checar permissão: precisa ser admin de barbearia (role=admin e barbershop_id NOT NULL)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const profile = prof as ProfileRow;

    if (profile.role !== "admin" || !profile.barbershop_id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const barbershopId = profile.barbershop_id;

    // 3) Body
    const raw = (await req.json().catch(() => null)) as InviteBody | null;

    const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Informe o email." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Informe o nome do barbeiro." }, { status: 400 });
    }

    // 4) Service role (ignora RLS) para:
    // - convidar usuário no Auth
    // - upsert no profiles
    // - insert no barbers
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const adminSupabase = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 5) redirect do convite (IMPORTANTE)
    // O link do email precisa voltar pra um lugar que finalize a sessão e mande pra tela de criar senha.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)" },
        { status: 500 }
      );
    }

    // ✅ manda pro callback (onde você troca tokens por sessão/cookies)
    const redirectTo = `${appUrl}/auth/callback`;

    // 6) Convida no Auth
    const { data: invited, error: inviteErr } =
      await adminSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          role: "barber",
          barbershop_id: barbershopId,
          name,
        },
      });

    if (inviteErr) {
      return NextResponse.json(
        { error: `Falhou convite: ${inviteErr.message}` },
        { status: 400 }
      );
    }

    const invitedUserId = invited?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json(
        { error: "Convite enviado, mas não consegui obter o ID do usuário." },
        { status: 400 }
      );
    }

    // 7) Garante profile do barbeiro
    const { error: upsertProfileErr } = await adminSupabase.from("profiles").upsert(
      {
        id: invitedUserId,
        role: "barber",
        barbershop_id: barbershopId,
        name,
      },
      { onConflict: "id" }
    );

    if (upsertProfileErr) {
      return NextResponse.json(
        { error: `Convite ok, mas falhou criar profile: ${upsertProfileErr.message}` },
        { status: 400 }
      );
    }

    // 8) Cria registro do barbeiro vinculado ao profile_id
    // (se já existir por qualquer motivo, não quebra o fluxo)
    const { error: insertBarberErr } = await adminSupabase.from("barbers").insert({
      profile_id: invitedUserId,
      name,
      phone: phone ? onlyDigits(phone) : null,
      active: true,
      barbershop_id: barbershopId,
    });

    // Se der erro por duplicidade, tudo bem: já existe barber row
    if (insertBarberErr) {
      const msg = insertBarberErr.message.toLowerCase();
      const isDup =
        msg.includes("duplicate key") ||
        msg.includes("already exists") ||
        msg.includes("unique") ||
        msg.includes("barbers_profile_id_unique");

      if (!isDup) {
        return NextResponse.json(
          { error: `Convite ok, mas falhou criar barbeiro: ${insertBarberErr.message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      invited_email: email,
      barber_name: name,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
