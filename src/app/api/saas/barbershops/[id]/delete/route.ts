import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

async function safeCount(
  adminSupabase: SupabaseClient,
  table: string,
  barbershopId: string,
): Promise<number> {
  const { count, error } = await adminSupabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId);

  // Se a tabela não existir ou der erro, não bloqueia exclusão
  if (error) return 0;

  return typeof count === "number" ? count : 0;
}

export async function POST(req: Request, context: { params: { id: string } }) {
  try {
    const supabase = createAuthedClient();

    // 1️⃣ Verifica autenticação
    const { data: authData, error: authErr } = await supabase.auth.getUser();

    if (authErr || !authData.user) {
      return NextResponse.json(
        { error: authErr?.message ?? "Não autenticado.", step: "auth" },
        { status: 401 },
      );
    }

    // 2️⃣ Verifica permissão (admin da plataforma)
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

    // 3️⃣ Valida ID
    const id = (context?.params?.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "ID inválido.", step: "params" },
        { status: 400 },
      );
    }

    // 4️⃣ Service Role (bypass RLS)
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

    // 5️⃣ Verifica vínculos antes de excluir
    const tablesToCheck = [
      "appointments",
      "services",
      "barbers",
      "working_hours",
      "clients",
    ];

    const counts: Record<string, number> = {};

    for (const table of tablesToCheck) {
      counts[table] = await safeCount(adminSupabase, table, id);
    }

    const totalLinks = Object.values(counts).reduce(
      (acc, value) => acc + value,
      0,
    );

    if (totalLinks > 0) {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir: existem registros vinculados a essa barbearia.",
          step: "blocked",
          details: counts,
        },
        { status: 409 },
      );
    }

    // 6️⃣ Remove profiles vinculados (opcional)
    await adminSupabase.from("profiles").delete().eq("barbershop_id", id);

    // 7️⃣ Remove barbearia
    const { error: delErr } = await adminSupabase
      .from("barbershops")
      .delete()
      .eq("id", id);

    if (delErr) {
      return NextResponse.json(
        { error: delErr.message, step: "delete" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      id,
      deleted: true,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { error: message, step: "catch" },
      { status: 500 },
    );
  }
}
