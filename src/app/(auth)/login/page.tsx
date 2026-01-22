"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  role: string;
  barbershop_id: string | null;
};

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const search = useSearchParams();

  const nextParam = search.get("next") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ 1) Se caiu no /login com #access_token (convite/reset), manda pro /callback
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash && hash.includes("access_token=")) {
      router.replace(`/callback${hash}`);
      return;
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 2) Se já estiver logado, redireciona certo (evita ficar preso no login)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      // se veio ?next=..., respeita
      if (nextParam) {
        router.replace(nextParam);
        return;
      }

      // senão, roteia por role
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", data.session.user.id)
        .single();

      if (error || !prof) {
        router.replace("/");
        return;
      }

      const p = prof as Profile;

      if (p.role === "admin") {
        // admin plataforma (barbershop_id null) vai pro saas
        if (p.barbershop_id === null) router.replace("/admin/saas/barbearias");
        else router.replace("/admin/onboarding");
        return;
      }

      if (p.role === "barber") {
        router.replace("/barbeiro/dashboard");
        return;
      }

      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextParam]);

  async function handleLogin() {
    setMsg(null);
    setSaving(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.session) {
      setMsg("Erro no login: " + (error?.message || "Sessão não criada"));
      setSaving(false);
      return;
    }

    // ✅ Se veio ?next=..., respeita
    if (nextParam) {
      router.replace(nextParam);
      setSaving(false);
      return;
    }

    // ✅ Senão, roteia por role (pra não cair na raiz e parecer “preso”)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", data.session.user.id)
      .single();

    if (profErr || !prof) {
      router.replace("/");
      setSaving(false);
      return;
    }

    const p = prof as Profile;

    if (p.role === "admin") {
      if (p.barbershop_id === null) router.replace("/admin/saas/barbearias");
      else router.replace("/admin/onboarding");
      setSaving(false);
      return;
    }

    if (p.role === "barber") {
      router.replace("/barbeiro/dashboard");
      setSaving(false);
      return;
    }

    router.replace("/");
    setSaving(false);
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
          Entrar no <span className="text-yellow-400">Barber Premium</span>
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

        <div>
          <label className="text-sm text-zinc-400">Senha</label>
          <input
            type="password"
            className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={saving}
          className="h-12 w-full rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
        >
          {saving ? "Entrando..." : "Entrar"}
        </button>

        {nextParam && (
          <p className="text-xs text-zinc-500">
            Após entrar, você será redirecionado para:{" "}
            <span className="text-zinc-300 font-semibold">{nextParam}</span>
          </p>
        )}
      </div>
    </div>
  );
}
