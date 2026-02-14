"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setMsg(null);
    setLoading(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      setMsg("Erro: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Link enviado. Verifique seu email.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-black">
          Recuperar <span className="text-yellow-400">senha</span>
        </h1>

        {msg && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-200">
            {msg}
          </div>
        )}

        <div>
          <label className="text-sm text-zinc-400">Email</label>
          <input
            className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={loading}
          className="h-12 w-full rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar link"}
        </button>
      </div>
    </div>
  );
}
