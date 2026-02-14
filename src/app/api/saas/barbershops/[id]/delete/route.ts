import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, PostgrestError } from "@supabase/supabase-js";

type SupabaseCookieOptions = Partial<{
  path: string;
  domain: string;
  maxAge: number;
  expires: Date;
  httpOnly: boolean;
  secure: boolean;
  sameSite: boolean | "lax" | "strict" | "none";
}>;

type SupabaseCookieToSet = {
  name: string;
  value: string;
  options: SupabaseCookieOptions;
};

type ProfileMeRow = {
  id: string;
  role: string;
  barbershop_id: string | null;
};

type ProfileIdRow = {
  id: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const barbershopId = params.id;

  const cookieStore = cookies();
  const pendingCookies: SupabaseCookieToSet[] = [];

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pendingCookies) {
      res.cookies.set({ name: c.name, value: c.value, ...c.options });
    }
    return res;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  try {
    // AUTH
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;

    if (authErr || !user) {
      return applyPendingCookies(
        NextResponse.json(
          {
            error: "unauthorized",
            step: "auth",
            details: authErr?.message ?? null,
          },
          { status: 401 },
        ),
      );
    }

    // PERMISSÃO
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id")
      .eq("id", user.id)
      .single<ProfileMeRow>();

    if (meErr || !me) {
      return applyPendingCookies(
        NextResponse.json(
          {
            error: "profile_not_found",
            step: "profile",
            details: meErr?.message ?? null,
          },
          { status: 403 },
        ),
      );
    }

    const isPlatformAdmin = me.role === "admin" && me.barbershop_id === null;
    if (!isPlatformAdmin) {
      return applyPendingCookies(
        NextResponse.json(
          {
            error: "forbidden",
            step: "permission",
            details: { role: me.role, barbershop_id: me.barbershop_id },
          },
          { status: 403 },
        ),
      );
    }

    // SERVICE ROLE
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return applyPendingCookies(
        NextResponse.json(
          {
            error: "missing_env",
            step: "env",
            details: {
              hasUrl: Boolean(url),
              hasServiceRoleKey: Boolean(serviceKey),
            },
          },
          { status: 500 },
        ),
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // LISTAR PROFILES DA BARBEARIA
    const { data: shopProfiles, error: shopProfilesErr } = await admin
      .from("profiles")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .returns<ProfileIdRow[]>();

    if (shopProfilesErr) {
      const err = shopProfilesErr as PostgrestError;
      return applyPendingCookies(
        NextResponse.json(
          {
            error: "failed_list_users",
            step: "list_users",
            details: { message: err.message, code: err.code },
          },
          { status: 400 },
        ),
      );
    }

    const userIds = (shopProfiles ?? []).map((p) => p.id);

    // DELETAR AUTH USERS
    const deleteUserResults: Array<{
      userId: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const uid of userIds) {
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) {
        deleteUserResults.push({
          userId: uid,
          ok: false,
          error: error.message,
        });
      } else {
        deleteUserResults.push({ userId: uid, ok: true });
      }
    }

    // DELETAR BARBERSHOP (CASCADE NO BANCO)
    const { data: deletedShop, error: delShopErr } = await admin
      .from("barbershops")
      .delete()
      .eq("id", barbershopId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (delShopErr) {
      const err = delShopErr as PostgrestError;
      const status = err.code === "23503" ? 409 : 400;

      return applyPendingCookies(
        NextResponse.json(
          {
            error: "delete_failed",
            step: "delete_barbershop",
            details: { message: err.message, code: err.code },
          },
          { status },
        ),
      );
    }

    if (!deletedShop?.id) {
      return applyPendingCookies(
        NextResponse.json(
          { error: "not_found", step: "delete_barbershop" },
          { status: 404 },
        ),
      );
    }

    return applyPendingCookies(
      NextResponse.json(
        {
          ok: true,
          deletedId: deletedShop.id,
          deletedAuthUsers: deleteUserResults.filter((r) => r.ok).length,
        },
        { status: 200 },
      ),
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return applyPendingCookies(
      NextResponse.json(
        { error: "internal_error", step: "catch", details: message },
        { status: 500 },
      ),
    );
  }
}
