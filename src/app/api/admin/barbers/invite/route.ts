import { NextResponse } from "next/server";
import { createClient as createAuthedClient } from "@/lib/supabase/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

function safeName(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function safeEmail(v: unknown) {
  if (typeof v !== "string") return null;
  const s = normalizeEmail(v);
  if (!s) return null;
  if (!s.includes("@") || !s.includes(".")) return null;
  return s;
}

/**
 * Tenta pegar o user id pelo email se o seu supabase-js tiver admin.getUserByEmail.
 * Tipamos como SupabaseClient<any> pra evitar guerra de genéricos.
 */
async function getUserIdByEmailIfAvailable(
  adminSupabase: SupabaseClient<any>,
  email: string
): Promise<string | null> {
  // Nem toda versão expõe getUserByEmail
  const admin = (adminSupabase.auth.admin as unknown) as {
    getUserByEmail?: (
      email: string
    ) => Promise<{
      data?: { user?: { id?: string } | null };
      error?: { message: string } | null;
    }>;
  };

  if (typeof admin.getUserByEmail !== "function") return null;

  const { data, error } = await admin.getUserByEmail(email);
  if (error) return null;

  return data?.user?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedClient();

    // 0) auth
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 1) quem convida precisa ser ADMIN de barbearia (barbershop_id NOT NULL)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    if (prof.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    if (!prof.barbershop_id) {
      return NextResponse.json(
        { error: "Apenas admin de barbearia pode convidar barbeiro aqui." },
        { status: 403 }
      );
    }

    // 2) body
    const body = await req.json().catch(() => null);
    const email = safeEmail(body?.email);
    const name = safeName(body?.name);

    if (!email) {
      return NextResponse.json({ error: "Informe um email válido." }, { status: 400 });
    }

    // 3) service client (ignora RLS)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "Env faltando: NEXT_PUBLIC_APP_URL (ex: https://seuapp.vercel.app)" },
        { status: 500 }
      );
    }

    // 👇 aqui também tipamos como SupabaseClient<any> pra evitar conflito de genéricos
    const adminSupabase: SupabaseClient<any> = createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ fluxo correto:
    // invite -> /auth/callback -> callback cria sessão -> redireciona /update-password
    const redirectTo = `${appUrl}/auth/callback?next=/update-password`;

    // 4) convida
    const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          role: "barber",
          barbershop_id: prof.barbershop_id,
          name: name || null,
        },
      }
    );

    let invitedUserId = invited?.user?.id ?? null;

    // Se já existe usuário com esse email, tentamos pegar o id (se sua versão suportar)
    if (!invitedUserId && inviteErr) {
      const msg = inviteErr.message?.toLowerCase?.() || "";
      const alreadyRegistered =
        msg.includes("already been registered") || msg.includes("already registered");

      if (!alreadyRegistered) {
        return NextResponse.json({ error: inviteErr.message }, { status: 400 });
      }

      const existingId = await getUserIdByEmailIfAvailable(adminSupabase, email);

      if (!existingId) {
        return NextResponse.json(
          {
            error:
              "Esse email já existe no Auth, e sua versão do Supabase não expõe getUserByEmail. " +
              "Solução rápida: apague o usuário desse email no Supabase Auth e convide novamente.",
          },
          { status: 400 }
        );
      }

      invitedUserId = existingId;
    }

    if (!invitedUserId) {
      return NextResponse.json({ error: "Não consegui obter o ID do usuário." }, { status: 400 });
    }

    // 5) upsert profile (SERVICE ROLE ignora RLS)
    const { error: upsertProfErr } = await adminSupabase.from("profiles").upsert(
      {
        id: invitedUserId,
        role: "barber",
        barbershop_id: prof.barbershop_id,
        name: name || email,
      },
      { onConflict: "id" }
    );

    if (upsertProfErr) {
      return NextResponse.json(
        { error: `Convite ok, mas falhou criar profile: ${upsertProfErr.message}` },
        { status: 400 }
      );
    }

    // 6) upsert barbers vinculando profile_id -> barbeiro
    const { error: upsertBarberErr } = await adminSupabase.from("barbers").upsert(
      {
        profile_id: invitedUserId,
        barbershop_id: prof.barbershop_id,
        name: name || email,
        phone: null,
        active: true,
      },
      { onConflict: "profile_id" }
    );

    if (upsertBarberErr) {
      return NextResponse.json(
        { error: `Convite ok, mas falhou criar/vincular barbeiro: ${upsertBarberErr.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      invited_email: email,
      barbershop_id: prof.barbershop_id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
