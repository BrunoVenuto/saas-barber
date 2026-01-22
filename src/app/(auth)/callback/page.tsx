"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

function getHashParam(name: string) {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash || "";
  const params = new URLSearchParams(hash);
  return params.get(name);
}

export default function AuthCallbackPage() {
  const supabase = createClient();
  const router = useRouter();

  const [msg, setMsg] = useState<string | null>("Processando login...");
  const [working, setWorking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setWorking(true);

        // ✅ Links de convite geralmente chegam assim:
        // /callback#access_token=...&refresh_token=...&type=invite
        const access_token = getHashParam("access_token");
        const refresh_token = getHashParam("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            setMsg("Erro ao criar sessão: " + error.message);
            setWorking(false);
            return;
          }

          // limpa o hash da URL (pra não ficar expondo token no navegador)
          window.history.replaceState({}, document.title, window.location.pathname);

          // ✅ Agora o usuário já está logado -> manda pra criar senha
          router.replace("/update-password");
          return;
        }

        // Se não veio pelo hash, pode ser outro tipo de callback (ou já tem sessão)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setMsg("Erro ao validar sessão: " + error.message);
          setWorking(false);
          return;
        }

        if (!data.session) {
          setMsg("Sessão inválida. Abra o link do email novamente.");
          setWorking(false);
          return;
        }

        router.replace("/update-password");
      } catch (e: any) {
        setMsg("Erro inesperado no callback: " + (e?.message || String(e)));
        setWorking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-3">
        <h1 className="text-2xl font-black">
          Entrando no <span className="text-yellow-400">Barber Premium</span>
        </h1>

        <p className="text-zinc-400 text-sm">
          {working ? "Aguarde só um instante..." : "Confira a mensagem abaixo."}
        </p>

        {msg && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-200">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
