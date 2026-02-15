import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { supabase, applyToResponse } = createClient();

  // signOut vai gerar cookies de limpeza -> precisamos aplicar no response
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  const res = NextResponse.redirect(url);

  // aplica cookies pendentes do supabase (limpeza de sessão)
  applyToResponse(res);

  // limpa cookie de impersonation (se existir)
  res.cookies.set("sb-impersonate-shop-id", "", {
    path: "/",
    maxAge: 0,
  });

  return res;
}
