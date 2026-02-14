"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type LoginState = "idle" | "loading";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Se já estiver logado, manda pro admin (sem onboarding)
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (data.session) {
        router.replace("/admin/dashboard");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  // Mensagem opcional via querystring
  useEffect(() => {
    const msg = searchParams.get("msg");
    if (msg) setMessage(msg);
  }, [searchParams]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setMessage("Preencha email e senha.");
      return;
    }

    setState("loading");

    const { error } = await supabase.auth.signInWithPassword({
      email: em,
      password,
    });

    if (error) {
      setState("idle");
      setMessage("Email ou senha inválidos.");
      return;
    }

    setState("idle");
    router.replace("/admin/dashboard");
  }

  async function handleForgotPassword() {
    setMessage(null);

    const em = email.trim().toLowerCase();
    if (!em) {
      setMessage("Digite seu email para receber o link de criar/trocar senha.");
      return;
    }

    setState("loading");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/update-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo,
    });

    setState("idle");

    if (error) {
      setMessage("Erro ao enviar email: " + error.message);
      return;
    }

    setMessage("Link enviado! Verifique seu email para criar/trocar a senha.");
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black">
            Entrar no <span className="text-yellow-400">Painel</span>
          </h1>
          <p className="text-zinc-400 text-sm">
            Use o email e a senha que o administrador definiu, ou crie/troque a
            senha pelo link.
          </p>
        </div>

        {message && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-200 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400">Email</label>
            <input
              type="email"
              className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoComplete="email"
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
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={state === "loading"}
            className="h-12 w-full rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
          >
            {state === "loading" ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-yellow-300 hover:underline"
            disabled={state === "loading"}
          >
            Esqueci minha senha
          </button>

          <Link className="text-zinc-400 hover:underline" href="/">
            Voltar
          </Link>
        </div>

        <p className="text-xs text-zinc-500">
          Se você recebeu um convite por email, abra o link para criar a senha.
          Se você já tem senha definida pelo admin, é só logar aqui.
        </p>
      </div>
    </div>
  );
}
