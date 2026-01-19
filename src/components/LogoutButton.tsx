"use client";

import { supabase } from "@/lib/supabase/client";

export function LogoutButton() {
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      className="bg-red-600 text-white px-4 py-2 rounded"
    >
      Sair
    </button>
  );
}
