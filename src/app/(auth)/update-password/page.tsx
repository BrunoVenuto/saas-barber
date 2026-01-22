"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // garante que existe sessão (após /auth/callback)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Sessão inválida. Abra o link do email novamente.");
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setMsg(null);

    if (password.length < 6) {
      setMsg("Senha fraca. Use pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMsg("As senhas não conferem.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg("Erro ao salvar senha: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.replace("/admin/onboarding");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-black">
          Definir <span className="text-yellow-400">senha</span>
        </h1>
        <p className="text-zinc-400 text-sm">
          Crie sua senha para acessar o painel.
        </p>

        {msg && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-200">
            {msg}
          </div>
        )}

        <div>
          <label className="text-sm text-zinc-400">Nova senha</label>
          <input
            type="password"
            className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Confirmar senha</label>
          <input
            type="password"
            className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="******"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 w-full rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar senha"}
        </button>
      </div>
    </div>
  );
}
