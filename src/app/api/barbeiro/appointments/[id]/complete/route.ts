import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Params = { id: string };

type ProfileRow = {
  id: string;
  role: string | null;
};

type BarberRow = {
  id: string;
};

type AppointmentRow = {
  id: string;
  status: string;
};

function getSupabaseServerClient() {
  const cookieStore = cookies();

  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Parameters<typeof cookieStore.set>[2];
  }> = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars (URL/ANON_KEY).");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({
            name,
            value,
            options: options ?? {},
          });
        });
      },
    },
  });

  return { supabase, pendingCookies };
}

function applyPendingCookies(
  res: NextResponse,
  pending: ReturnType<typeof getSupabaseServerClient>["pendingCookies"],
) {
  pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
  return res;
}

export async function POST(_req: Request, ctx: { params: Params }) {
  try {
    const { supabase, pendingCookies } = getSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    // 🚫 NÃO aplicar pending cookies em falha de auth
    if (userErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single<ProfileRow>();

    if (profileErr || !profile) {
      const res = NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    if (profile.role !== "barber") {
      const res = NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    const { data: barber, error: barberErr } = await supabase
      .from("barbers")
      .select("id")
      .eq("profile_id", profile.id)
      .single<BarberRow>();

    if (barberErr || !barber) {
      const res = NextResponse.json(
        { error: "Barbeiro não vinculado ao usuário (barbers.profile_id)." },
        { status: 400 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    const apId = ctx.params.id;

    // ✅ STATUS PERMITIDO PELO CHECK CONSTRAINT
    const { data: updated, error: updErr } = await supabase
      .from("appointments")
      .update({ status: "done" })
      .eq("id", apId)
      .eq("barber_id", barber.id)
      .select("id, status")
      .single<AppointmentRow>();

    if (updErr) {
      const res = NextResponse.json({ error: updErr.message }, { status: 400 });
      return applyPendingCookies(res, pendingCookies);
    }

    const res = NextResponse.json(
      { ok: true, appointment: updated },
      { status: 200 },
    );
    return applyPendingCookies(res, pendingCookies);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
