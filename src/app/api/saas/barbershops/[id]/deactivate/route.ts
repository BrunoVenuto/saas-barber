import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const supabase = createAuthedClient();

    // 1) Auth
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      return NextResponse.json(
        { error: authErr?.message ?? "Não autenticado.", step: "auth" },
        { status: 401 },
      );
    }

    // 2) Permissão: admin plataforma (role=admin e barbershop_id null)
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
    const isPlatformAdmin =
      profRow.role === "admin" && profRow.barbershop_id === null;

    if (!isPlatformAdmin) {
      return NextResponse.json(
        {
          error: "Sem permissão (apenas admin plataforma).",
          step: "permission",
        },
        { status: 403 },
      );
    }

    // 3) ID
    const id = (ctx?.params?.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "ID inválido.", step: "params" },
        { status: 400 },
      );
    }

    // 4) Service client
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

    // 5) Update
    const { error: updErr } = await adminSupabase
      .from("barbershops")
      .update({ is_active: false })
      .eq("id", id);

    if (updErr) {
      return NextResponse.json(
        { error: updErr.message, step: "update" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, id, is_active: false });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { error: message, step: "catch" },
      { status: 500 },
    );
  }
}
