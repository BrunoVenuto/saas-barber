"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Role = "admin" | "barber" | "client" | string;

type ProfilesRow = {
  role: Role | null;
  barbershop_id: string | null;
};

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

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

  useEffect(() => {
    const type = searchParams.get("type");
    const accessToken = searchParams.get("access_token");

    if (type === "invite" || accessToken) {
      setMode("set-password");
      setMsg("Convite detectado! Crie sua senha para finalizar seu acesso.");
    } else {
      setMode("login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncSessionToCookies(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.access_token || !session?.refresh_token) return;

    const payload: SessionTokens = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };

    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function redirectByRole(userId: string): Promise<void> {
    const redirectTo = searchParams.get("redirect");
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role, barbershop_id")
      .eq("id", userId)
      .single<ProfilesRow>();

    if (profErr || !profile?.role) {
      setMsg("Seu usuário não tem perfil válido no sistema.");
      return;
    }

    const role = profile.role as Role;

    if (role === "admin") {
      if (profile.barbershop_id === null) {
        router.replace("/admin/saas/barbearias");
      } else {
        router.replace("/admin/agenda");
      }
      return;
    }

    if (role === "barber") {
      router.replace("/barbeiro/dashboard");
      return;
    }

    router.replace("/");
  }

  async function handleLogin(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
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

    // 🔐 garante que a sessão fique também em cookies (para o middleware enxergar)
    await syncSessionToCookies();

    // ✅ pega o userId de forma segura (data.user pode vir null em alguns cenários)
    let userId: string | null = data.user?.id ?? null;

    if (!userId) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.id) {
        setMsg("Login OK, mas não consegui obter o usuário.");
        setLoading(false);
        return;
      }
      userId = userData.user.id;
    }

    await redirectByRole(userId);
    setLoading(false);
  }

  async function handleSetPassword(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
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

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData.user;

    if (userErr || !user) {
      setMsg(
        "Sessão do convite não encontrada. Abra novamente o link do email.",
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg("Erro ao definir senha: " + error.message);
      setLoading(false);
      return;
    }

    // 🔐 garante cookies para o middleware após trocar a senha também
    await syncSessionToCookies();

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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
            />

            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Sua senha"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewPassword(e.target.value)
              }
              autoComplete="new-password"
            />

            <input
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              placeholder="Confirmar nova senha"
              type="password"
              value={newPassword2}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewPassword2(e.target.value)
              }
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
