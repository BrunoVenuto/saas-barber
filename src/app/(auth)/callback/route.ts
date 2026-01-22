import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  // Se não veio code, só manda pra home
  if (!code) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const supabase = createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // Se falhar, manda pro login com erro
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // ✅ Agora o usuário está logado (cookie setado)
  return NextResponse.redirect(`${origin}${next}`);
}
