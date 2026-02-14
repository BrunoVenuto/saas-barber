import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();

  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  const res = NextResponse.redirect(url);

  // limpa cookie de impersonation (se existir)
  res.cookies.set("sb-impersonate-shop-id", "", {
    path: "/",
    maxAge: 0,
  });

  return res;
}
