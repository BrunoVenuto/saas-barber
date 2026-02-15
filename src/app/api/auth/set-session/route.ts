import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SetSessionBody = {
  access_token: string;
  refresh_token: string;
};

function isSetSessionBody(v: unknown): v is SetSessionBody {
  if (typeof v !== "object" || v === null) return false;

  const obj = v as Record<string, unknown>;
  return (
    typeof obj.access_token === "string" &&
    typeof obj.refresh_token === "string"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json().catch(() => null);

    if (!isSetSessionBody(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const access_token = body.access_token.trim();
    const refresh_token = body.refresh_token.trim();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Missing access_token or refresh_token" },
        { status: 400 },
      );
    }

    const { supabase, applyToResponse } = createClient();

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      // Aqui NÃO queremos aplicar cookies pendentes em erro
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // ✅ setSession normalmente gera cookies -> aplicar no response
    const res = NextResponse.json({ ok: true }, { status: 200 });
    return applyToResponse(res);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
