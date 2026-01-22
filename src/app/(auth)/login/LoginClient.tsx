"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Role = "admin" | "barber" | "client" | string;

function parseHashParams(hash: string) {
  // hash vem tipo "#access_token=...&type=invite"
  const h = (hash || "").startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(h);
}

export default function LoginClient() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "set-password">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // next (padrão do middleware)
  const next = searchParams.get("next") || null;

  useEffect(() => {
    // Detecta convite tanto por query quanto por HASH
    const typeQ = searchParams.get("type"); // às vezes vem em query
    const accessTokenQ = searchParams.get("access_token");

    const hashParams =
      typeof window !== "undefined" ? parseHashParams(window.location.hash) : null;

    const typeH = hashParams?.get("type");
    const accessTokenH = hashParams?.get("access_token");

    const isInvite = typeQ === "invite" || typeH === "invite" || !!accessTokenQ || !!accessTokenH;

    if (isInvite) {
      setMode("set-password");
      setMsg("Convite detectado! Crie sua senha para finalizar seu acesso.");
    } else {
      setMode("login");
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redirectByRole(userId: string) {
    // Prioridade: next do middleware
    // Evita loop caso alguém mande next=/login
    const safeNext =
      next && next !== "/login" && !next.startsWith("/login?") ? next : null;

    if (safeNext) {
      router.replace(safeNext);
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", userId)
      .single();

    if (profErr || !profile?.role) {
      setMsg("Seu usuário não tem perfil válido no sistema.");
      return;
    }

    const role = profile.role as Role;

    if (role === "admin") {
      if (profile.barbershop_id === null) {
        router.replace("/admin/saas/barbearias");
      } else {
        router.replace("/admin/onboarding"); // ✅ admin de barbearia entra no onboarding
      }
      return;
    }

    if (role === "barber") {
      router.replace("/barbeiro/dashboard");
      return;
    }

    router.replace("/");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email || !password) {
      setMsg("Preencha email e senha.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg("Erro no login: " + error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setMsg("Não foi possível obter o usuário.");
      setLoading(false);
      return;
    }

    await redirectByRole(user.id);
    setLoading(false);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!newPassword || !newPassword2) {
      setMsg("Preencha a nova senha duas vezes.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== newPassword2) {
      setMsg("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    // Importante: após clicar no link do convite, o supabase cria sessão.
    // Se a sessão não existir, é porque o link não foi processado corretamente (ou expirou).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setMsg("Sessão do convite não encontrada. Abra novamente o link do email.");
      setLoading(false);
      return;
    }

    const user = session.user;

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg("Erro ao definir senha: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Senha criada com sucesso! Entrando...");
    await redirectByRole(user.id);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6">
        <h1 className="text-3xl font-black text-yellow-400">
          {mode === "login" ? "Login" : "Criar senha"}
        </h1>

        <p className="text-zinc-400 mt-2">
          {mode === "login"
            ? "Entre para acessar sua área."
            : "Finalize seu acesso criando sua senha."}
        </p>

        {msg && (
          <div className="mt-4 bg-black/40 border border-white/10 rounded-xl p-3 text-zinc-200 text-sm">
            {msg}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Sua senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button
              disabled={loading}
              className="w-full bg-yellow-400 text-black font-black py-3 rounded hover:scale-[1.02] transition disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetPassword} className="mt-6 space-y-4">
            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Nova senha (mín. 6 caracteres)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />

            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Confirmar nova senha"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />

            <button
              disabled={loading}
              className="w-full bg-emerald-500 text-black font-black py-3 rounded hover:scale-[1.02] transition disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Criar senha e entrar"}
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                setMode("login");
                setMsg("Você saiu. Faça login normalmente.");
              }}
              className="w-full bg-white/10 text-white font-black py-3 rounded hover:bg-white/15 transition"
            >
              Voltar para login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
