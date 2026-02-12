"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type HashParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_description?: string;
};

function parseHash(hash: string): HashParams {
  const out: HashParams = {};
  const clean = (hash || "").replace(/^#/, "");
  if (!clean) return out;

  const params = new URLSearchParams(clean);

  const access_token = params.get("access_token") ?? undefined;
  const refresh_token = params.get("refresh_token") ?? undefined;
  const type = params.get("type") ?? undefined;
  const error = params.get("error") ?? undefined;
  const error_description = params.get("error_description") ?? undefined;

  if (access_token) out.access_token = access_token;
  if (refresh_token) out.refresh_token = refresh_token;
  if (type) out.type = type;
  if (error) out.error = error;
  if (error_description) out.error_description = error_description;

  return out;
}

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // ✅ Processa hash (convite) OU sessão existente
  useEffect(() => {
    (async () => {
      setMsg(null);

      // 1) Checa se veio hash na URL (fluxo de convite direto)
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const h = parseHash(hash);

      if (h.error) {
        setMsg(h.error_description || h.error || "Erro no link de convite.");
        setLoading(false);
        return;
      }

      if (h.access_token && h.refresh_token) {
        // Tenta criar sessão com os tokens do hash
        const { error } = await supabase.auth.setSession({
          access_token: h.access_token,
          refresh_token: h.refresh_token,
        });

        if (error) {
          setMsg("Falha ao autenticar pelo link: " + error.message);
          setLoading(false);
          return;
        }

        // Limpa hash da URL (opcional, estética)
        window.history.replaceState({}, "", "/update-password");
      }

      // 2) Valida se temos sessão (seja pelo hash acima ou login prévio)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr) {
        setMsg("Erro ao validar sessão: " + sessionErr.message);
        setLoading(false);
        return;
      }

      if (!sessionData.session) {
        setMsg("Link inválido ou expirado. Peça um novo convite.");
        setLoading(false);
        return;
      }

      // 3) Se já existe profile e role, e o cara já tá onboarded, pode mandar pro painel
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // Se já é admin, teoricamente poderia ir pro dashboard/onboarding direto 
        // mas aqui deixamos ele definir a senha.
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

    // ✅ após criar senha, vai para o onboarding do admin da barbearia
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

        <p className="text-xs text-zinc-500">
          Se aparecer “Link inválido”, verifique se o email não expirou.
        </p>
      </div>
    </div>
  );
}
