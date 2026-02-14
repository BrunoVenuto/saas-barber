import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  if (profile.role !== "barber") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data: barber, error: barberErr } = await supabase
    .from("barbers")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (barberErr || !barber) {
    return NextResponse.json(
      { error: "Barbeiro não vinculado ao usuário (barbers.profile_id)." },
      { status: 400 }
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("appointments")
    .update({ status: "canceled" })
    .eq("id", params.id)
    .eq("barber_id", barber.id)
    .select("id, status")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, appointment: updated });
}
