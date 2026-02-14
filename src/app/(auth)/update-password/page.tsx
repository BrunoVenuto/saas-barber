"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type ViewState = "loading" | "ready" | "saving";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<ViewState>("loading");
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // opcional: mensagem via querystring
  useEffect(() => {
    const m = searchParams.get("msg");
    if (m) setMsg(m);
  }, [searchParams]);

  // Processa hash (convite) OU sessão já existente
  useEffect(() => {
    let alive = true;

    (async () => {
      setMsg(null);

      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const h = parseHash(hash);

      if (h.error) {
        if (!alive) return;
        setMsg(h.error_description || h.error || "Erro no link.");
        setState("ready");
        return;
      }

      // Se veio token via hash, cria sessão
      if (h.access_token && h.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: h.access_token,
          refresh_token: h.refresh_token,
        });

        if (!alive) return;

        if (error) {
          setMsg("Falha ao autenticar pelo link: " + error.message);
          setState("ready");
          return;
        }

        // limpa hash pra não ficar exposto na URL
        window.history.replaceState({}, "", "/update-password");
      }

      // valida se tem sessão
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (!alive) return;

      if (sessionErr) {
        setMsg("Erro ao validar sessão: " + sessionErr.message);
        setState("ready");
        return;
      }

      if (!sessionData.session) {
        setMsg("Link inválido ou expirado. Peça um novo convite.");
        setState("ready");
        return;
      }

      setState("ready");
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function handleSave() {
    setMsg(null);

    const pass = password.trim();
    const conf = confirm.trim();

    if (pass.length < 6) {
      setMsg("Senha fraca. Use pelo menos 6 caracteres.");
      return;
    }

    if (pass !== conf) {
      setMsg("As senhas não conferem.");
      return;
    }

    setState("saving");

    const { error } = await supabase.auth.updateUser({ password: pass });

    if (error) {
      setMsg("Erro ao salvar senha: " + error.message);
      setState("ready");
      return;
    }

    // ✅ Sem onboarding: vai direto pro painel
    router.replace("/admin/minha-barbearia");
  }

  if (state === "loading") {
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
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-200 text-sm">
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
            autoComplete="new-password"
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
            autoComplete="new-password"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={state === "saving"}
          className="h-12 w-full rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
        >
          {state === "saving" ? "Salvando..." : "Salvar senha"}
        </button>

        <p className="text-xs text-zinc-500">
          Se aparecer “Link inválido”, verifique se o email não expirou.
        </p>
      </div>
    </div>
  );
}
