import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type InviteBody = {
  name?: string;
  email?: string;
  phone?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedClient();

    // 1) auth user (quem está chamando: admin da barbearia)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Não autenticado.", step: "auth" }, { status: 401 });
    }

    // 2) profile do caller + permissão
    const { data: callerProfile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (profErr || !callerProfile) {
      return NextResponse.json({ error: "Perfil não encontrado.", step: "profile" }, { status: 404 });
    }

    // ✅ precisa ser admin de UMA barbearia (barbershop_id NOT NULL)
    if (callerProfile.role !== "admin" || !callerProfile.barbershop_id) {
      return NextResponse.json(
        { error: "Sem permissão. Apenas admin de barbearia.", step: "permission" },
        { status: 403 }
      );
    }

    const barbershopId = callerProfile.barbershop_id as string;

    // 3) body
    const body = (await req.json().catch(() => null)) as InviteBody | null;

    const name = (body?.name || "").trim();
    const email = (body?.email || "").trim().toLowerCase();
    const phoneDigits = body?.phone ? onlyDigits(body.phone) : null;

    if (!name) return NextResponse.json({ error: "Informe o nome.", step: "body" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Informe o email.", step: "body" }, { status: 400 });

    // 4) service client (bypass RLS)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL; // ex: https://seuapp.vercel.app

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY", step: "env" },
        { status: 500 }
      );
    }
    if (!appUrl) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)", step: "env" },
        { status: 500 }
      );
    }

    const adminSupabase = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 5) convite do usuário barbeiro
    // ✅ redirect volta pro /login e você detecta "invite" para criar senha
    const redirectTo = `${appUrl}/login?type=invite`;

    const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        role: "barber",
        barbershop_id: barbershopId,
        name,
      },
    });

    if (inviteErr) {
      // exemplo comum: email já existe
      return NextResponse.json(
        { error: inviteErr.message, step: "invite" },
        { status: 400 }
      );
    }

    const invitedUserId = invited?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json(
        { error: "Convite enviado, mas não consegui obter o ID do usuário.", step: "invite_user_id" },
        { status: 400 }
      );
    }

    // 6) garantir profile do barbeiro (SERVICE ROLE ignora RLS)
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
        { error: `Convite ok, mas falhou criar profile: ${upsertProfileErr.message}`, step: "profile_upsert" },
        { status: 400 }
      );
    }

    // 7) criar/atualizar registro em barbers linkado ao profile_id do auth
    // ✅ isso permite /barbeiro/dashboard encontrar o barbeiro via profile_id = user.id
    const barberPayload = {
      profile_id: invitedUserId,
      barbershop_id: barbershopId,
      name,
      phone: phoneDigits,
      active: true,
    };

    // tenta achar se já existe um "barbers" para esse profile_id
    const { data: existingBarber, error: existingErr } = await adminSupabase
      .from("barbers")
      .select("id")
      .eq("profile_id", invitedUserId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message, step: "barber_lookup" },
        { status: 400 }
      );
    }

    if (existingBarber?.id) {
      const { error: updErr } = await adminSupabase
        .from("barbers")
        .update(barberPayload)
        .eq("id", existingBarber.id);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message, step: "barber_update" },
          { status: 400 }
        );
      }
    } else {
      const { error: insErr } = await adminSupabase.from("barbers").insert(barberPayload);

      if (insErr) {
        return NextResponse.json(
          { error: insErr.message, step: "barber_insert" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      invited_email: email,
      barbershop_id: barbershopId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message, step: "catch" }, { status: 500 });
  }
}
