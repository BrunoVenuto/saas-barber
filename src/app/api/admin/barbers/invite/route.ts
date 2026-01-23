import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type InviteBarberBody = {
  email: string;
  name: string;
  phone?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

export async function POST(req: Request) {
  try {
    // 0) client com sessão do usuário logado (RLS normal)
    const supabase = createAuthedClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 1) valida admin de barbearia
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    if (profile.role !== "admin" || !profile.barbershop_id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const barbershopId = profile.barbershop_id;

    // 2) body
    const raw = (await req.json().catch(() => null)) as unknown;

    if (!isObject(raw)) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const email = (getString(raw, "email") || "").trim().toLowerCase();
    const name = (getString(raw, "name") || "").trim();
    const phone = getString(raw, "phone");

    if (!email) {
      return NextResponse.json({ error: "Informe o email do barbeiro." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Informe o nome do barbeiro." }, { status: 400 });
    }

    const body: InviteBarberBody = {
      email,
      name,
      phone: phone ? phone.trim() : null,
    };

    // 3) service client (ignora RLS)
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

    // 4) convite (redirect cai no /login e lá ele cria senha)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)" },
        { status: 500 }
      );
    }

    const redirectTo = `${appUrl}/login?type=invite`;

    const { data: invited, error: inviteErr } =
      await adminSupabase.auth.admin.inviteUserByEmail(body.email, {
        redirectTo,
        data: {
          role: "barber",
          barbershop_id: barbershopId,
          name: body.name,
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

    // 5) garante profiles do barbeiro
    const { error: upsertProfileErr } = await adminSupabase.from("profiles").upsert(
      {
        id: invitedUserId,
        role: "barber",
        barbershop_id: barbershopId,
        name: body.name,
      },
      { onConflict: "id" }
    );

    if (upsertProfileErr) {
      return NextResponse.json(
        { error: `Convite ok, mas falhou profile: ${upsertProfileErr.message}` },
        { status: 400 }
      );
    }

    // 6) cria registro em barbers (vincula pelo profile_id)
    // Obs: se já existir (reinvite), evitamos duplicar.
    const { data: existingBarber, error: existingErr } = await adminSupabase
      .from("barbers")
      .select("id")
      .eq("profile_id", invitedUserId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: `Falhou checar barbeiro: ${existingErr.message}` },
        { status: 400 }
      );
    }

    if (!existingBarber?.id) {
      const { error: insertBarberErr } = await adminSupabase.from("barbers").insert({
        barbershop_id: barbershopId,
        profile_id: invitedUserId,
        name: body.name,
        phone: body.phone ? onlyDigits(body.phone) : null,
        active: true,
      });

      if (insertBarberErr) {
        return NextResponse.json(
          { error: `Falhou criar barbeiro: ${insertBarberErr.message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      invited_email: body.email,
      barber_user_id: invitedUserId,
      barbershop_id: barbershopId,
      redirectTo,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
