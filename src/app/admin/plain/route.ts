import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PlanKey = "start" | "pro" | "premium";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const plan = (body?.plan as PlanKey | undefined) || undefined;

    if (!plan || !["start", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (!profile?.barbershop_id) {
      return NextResponse.json({ error: "Usuário sem barbearia vinculada." }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from("barbershops")
      .update({ plan })
      .eq("id", profile.barbershop_id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro inesperado." }, { status: 500 });
  }
}
