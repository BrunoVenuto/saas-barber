import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  role: string | null;
  barbershop_id: string | null;
  name: string | null;
};

type ExistingBarberRow = {
  id: string;
  barbershop_id: string;
};

type InsertedBarberRow = { id: string };

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
    // 0) Client com sessão (RLS normal) só para validar quem está logado
    const { supabase, applyToResponse } = createAuthedClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    // 🚫 não aplicar cookies no 401
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 1) Confirma que é admin de barbearia (admin + barbershop_id NOT NULL)
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id, name")
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

    // 2) Body opcional (nome/telefone) para o dono-barber
    const raw: unknown = await req.json().catch(() => null);

    let name = profile.name ?? user.email ?? "Barbeiro";
    let phone: string | null = null;

    if (isObject(raw)) {
      const bodyName = getString(raw, "name");
      const bodyPhone = getString(raw, "phone");

      if (bodyName && bodyName.trim()) name = bodyName.trim();
      if (bodyPhone && bodyPhone.trim()) phone = onlyDigits(bodyPhone.trim());
    }

    // 3) Service client (garante que funciona mesmo com RLS apertado)
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

    // 4) Se já existir barber para esse profile_id, não duplica
    const { data: existingData, error: existsErr } = await adminSupabase
      .from("barbers")
      .select("id, barbershop_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    const existing = existingData as ExistingBarberRow | null;

    if (existsErr) {
      const res = NextResponse.json(
        { error: `Falhou checar barbeiro: ${existsErr.message}` },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    if (existing?.id) {
      // opcional: se existir mas estiver noutra barbearia, bloqueia
      if (existing.barbershop_id !== barbershopId) {
        const res = NextResponse.json(
          { error: "Este usuário já é barbeiro em outra barbearia." },
          { status: 409 },
        );
        return applyToResponse(res);
      }

      const res = NextResponse.json({
        ok: true,
        already: true,
        barber_id: existing.id,
        barbershop_id: barbershopId,
      });

      return applyToResponse(res);
    }

    // 5) Cria barber “dono” (vinculado ao próprio user.id)
    const { data: insertedData, error: insertErr } = await adminSupabase
      .from("barbers")
      .insert({
        barbershop_id: barbershopId,
        profile_id: user.id,
        name,
        phone,
        active: true,
      })
      .select("id")
      .single();

    const inserted = insertedData as InsertedBarberRow | null;

    if (insertErr || !inserted) {
      const res = NextResponse.json(
        { error: `Falhou criar barbeiro: ${insertErr?.message ?? "—"}` },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    const res = NextResponse.json({
      ok: true,
      already: false,
      barber_id: inserted.id,
      barbershop_id: barbershopId,
    });

    return applyToResponse(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
