import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAuthedClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // valida admin plataforma
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, barbershop_id")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.barbershop_id !== null) {
    return NextResponse.json(
      { error: "Sem permissão (apenas admin plataforma)." },
      { status: 403 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const { error } = await admin
    .from("barbershops")
    .update({ is_active: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
