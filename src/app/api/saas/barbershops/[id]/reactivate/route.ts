import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const { supabase, applyToResponse } = createAuthedClient();

    // 1) Auth
    const { data: authData, error: authErr } = await supabase.auth.getUser();

    // 🚫 NÃO aplicar cookies no 401
    if (authErr || !authData.user) {
      return NextResponse.json(
        { error: authErr?.message ?? "Não autenticado.", step: "auth" },
        { status: 401 },
      );
    }

    // 2) Permissão: admin plataforma (role=admin e barbershop_id null)
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", authData.user.id)
      .single();

    const profile = profData as ProfileRow | null;

    if (profErr || !profile) {
      const res = NextResponse.json(
        {
          error: profErr?.message ?? "Perfil não encontrado.",
          step: "profile",
        },
        { status: 403 },
      );
      return applyToResponse(res);
    }

    const isPlatformAdmin =
      profile.role === "admin" && profile.barbershop_id === null;

    if (!isPlatformAdmin) {
      const res = NextResponse.json(
        {
          error: "Sem permissão (apenas admin plataforma).",
          step: "permission",
        },
        { status: 403 },
      );
      return applyToResponse(res);
    }

    // 3) ID
    const id = (ctx?.params?.id ?? "").trim();
    if (!id) {
      const res = NextResponse.json(
        { error: "ID inválido.", step: "params" },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    // 4) Service client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      const res = NextResponse.json(
        {
          error:
            "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
          step: "env",
        },
        { status: 500 },
      );
      return applyToResponse(res);
    }

    const adminSupabase = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 5) Update (ativar)
    const { error: updErr } = await adminSupabase
      .from("barbershops")
      .update({ is_active: true })
      .eq("id", id);

    if (updErr) {
      const res = NextResponse.json(
        { error: updErr.message, step: "update" },
        { status: 400 },
      );
      return applyToResponse(res);
    }

    // ✅ OK
    const res = NextResponse.json({ ok: true, id, is_active: true });
    return applyToResponse(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { error: message, step: "catch" },
      { status: 500 },
    );
  }
}
