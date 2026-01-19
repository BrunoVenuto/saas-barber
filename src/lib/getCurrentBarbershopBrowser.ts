import { createClient } from "@/lib/supabase/browser";

export async function getCurrentBarbershopIdBrowser(): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("barbershop_id")
    .eq("id", user.id)
    .single();

  if (error || !profile?.barbershop_id) {
    console.error("Erro ao buscar barbearia:", error);
    return null;
  }

  return profile.barbershop_id;
}
