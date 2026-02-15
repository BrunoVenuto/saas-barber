import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type PlanKey = "start" | "pro" | "premium";

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

function isPlanKey(v: unknown): v is PlanKey {
  return v === "start" || v === "pro" || v === "premium";
}

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
        // IMPORTANT: não aplicar direto no cookieStore aqui.
        // Apenas armazenar e aplicar no response somente quando auth for válida.
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

export async function POST(req: Request) {
  try {
    const { supabase, pendingCookies } = getSupabaseServerClient();

    // 1) Autenticação (NÃO aplicar pending cookies se falhar)
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();

    if (uErr || !user) {
      return NextResponse.json(
        { error: uErr?.message ?? "Não autenticado." },
        { status: 401 },
      );
    }

    // 2) Body (sem cast solto)
    const rawBody: unknown = await req.json().catch(() => null);
    const planValue: unknown =
      rawBody && typeof rawBody === "object" && "plan" in rawBody
        ? (rawBody as { plan?: unknown }).plan
        : undefined;

    if (!isPlanKey(planValue)) {
      const res = NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    const plan: PlanKey = planValue;

    // 3) Checar perfil/admin
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single<ProfileRow>();

    if (pErr) {
      const res = NextResponse.json({ error: pErr.message }, { status: 400 });
      return applyPendingCookies(res, pendingCookies);
    }

    if ((profile?.role ?? null) !== "admin") {
      const res = NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    if (!profile?.barbershop_id) {
      const res = NextResponse.json(
        { error: "Usuário sem barbearia vinculada." },
        { status: 400 },
      );
      return applyPendingCookies(res, pendingCookies);
    }

    // 4) Update
    const { error: upErr } = await supabase
      .from("barbershops")
      .update({ plan })
      .eq("id", profile.barbershop_id);

    if (upErr) {
      const res = NextResponse.json({ error: upErr.message }, { status: 400 });
      return applyPendingCookies(res, pendingCookies);
    }

    // 5) OK (agora sim aplicamos cookies pendentes)
    const res = NextResponse.json({ ok: true }, { status: 200 });
    return applyPendingCookies(res, pendingCookies);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
