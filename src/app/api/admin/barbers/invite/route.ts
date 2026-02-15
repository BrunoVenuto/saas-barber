import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type InviteBarberBody = {
  email: string;
  name: string;
  phone?: string | null;
};

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

type BarberIdRow = { id: string };

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
    const { supabase, applyToResponse } = createAuthedClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    // 🚫 não aplicar cookies no 401
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 1) valida admin de barbearia
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single();

    const profile = profData as ProfileRow | null;

    if (profErr || !profile) {
      const res = NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 },
      );
      return applyToResponse(res);
    }

    if (profile.role !== "admin" || !profile.barbershop_id) {
      const res = NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
      return applyToResponse(res);
    }

    const barbershopId = profile.barbershop_id;

    // 2) body
    const raw: unknown = await req.json().catch(() => null);

    if (!isObject(raw)) {
      const res = NextResponse.json(
        { error: "Body inválido." },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    const email = (getString(raw, "email") || "").trim().toLowerCase();
    const name = (getString(raw, "name") || "").trim();
    const phone = getString(raw, "phone");

    if (!email) {
      const res = NextResponse.json(
        { error: "Informe o email do barbeiro." },
        { status: 400 },
      );
      return applyToResponse(res);
    }
    if (!name) {
      const res = NextResponse.json(
        { error: "Informe o nome do barbeiro." },
        { status: 400 },
      );
      return applyToResponse(res);
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
      const res = NextResponse.json(
        {
          error:
            "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 },
      );
      return applyToResponse(res);
    }

    const adminSupabase = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 4) redirect do convite -> passa primeiro pelo /callback pra setar sessão/cookies
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      const res = NextResponse.json(
        {
          error:
            "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)",
        },
        { status: 500 },
      );
      return applyToResponse(res);
    }

    // ✅ Ajuste chave:
    // manda o usuário pro /callback (rota pública), e de lá redireciona pro /login?type=invite
    const nextAfterCallback = "/login?type=invite";
    const redirectTo = `${appUrl}/callback?next=${encodeURIComponent(nextAfterCallback)}`;

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
      const res = NextResponse.json(
        { error: `Falhou convite: ${inviteErr.message}` },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    const invitedUserId = invited?.user?.id ?? null;
    if (!invitedUserId) {
      const res = NextResponse.json(
        { error: "Convite enviado, mas não consegui obter o ID do usuário." },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    // 5) garante profiles do barbeiro
    const { error: upsertProfileErr } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          role: "barber",
          barbershop_id: barbershopId,
          name: body.name,
        },
        { onConflict: "id" },
      );

    if (upsertProfileErr) {
      const res = NextResponse.json(
        {
          error: `Convite ok, mas falhou profile: ${upsertProfileErr.message}`,
        },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    // 6) cria registro em barbers (vincula pelo profile_id)
    const { data: existingData, error: existingErr } = await adminSupabase
      .from("barbers")
      .select("id")
      .eq("profile_id", invitedUserId)
      .maybeSingle();

    const existingBarber = existingData as BarberIdRow | null;

    if (existingErr) {
      const res = NextResponse.json(
        { error: `Falhou checar barbeiro: ${existingErr.message}` },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    if (!existingBarber?.id) {
      const { error: insertBarberErr } = await adminSupabase
        .from("barbers")
        .insert({
          barbershop_id: barbershopId,
          profile_id: invitedUserId,
          name: body.name,
          phone: body.phone ? onlyDigits(body.phone) : null,
          active: true,
        });

      if (insertBarberErr) {
        const res = NextResponse.json(
          { error: `Falhou criar barbeiro: ${insertBarberErr.message}` },
          { status: 400 },
        );
        return applyToResponse(res);
      }
    }

    // ✅ OK: aplica cookies pendentes só no final
    const res = NextResponse.json({
      ok: true,
      invited_email: body.email,
      barber_user_id: invitedUserId,
      barbershop_id: barbershopId,
      redirectTo,
    });

    return applyToResponse(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
