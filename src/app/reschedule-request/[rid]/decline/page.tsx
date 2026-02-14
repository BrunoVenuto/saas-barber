"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Params = { id: string };

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function isUuid(v: string | null): v is string {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

export default function DeclineRescheduleRequestPage() {
  const supabase = createClient();
  const { id } = useParams<Params>(); // request_id
  const sp = useSearchParams();
  const token = sp.get("token"); // request_token

  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string>("");

  const canRun = useMemo(() => isUuid(id) && isUuid(token), [id, token]);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setOk(null);
      setMsg("");

      if (!canRun) {
        setLoading(false);
        setOk(false);
        setMsg("Link inválido. Verifique se o link está completo.");
        return;
      }

      const { data, error } = await supabase.rpc(
        "rpc_decline_reschedule_request",
        {
          p_request_id: id,
          p_request_token: token,
        },
      );

      if (error) {
        setLoading(false);
        setOk(false);
        setMsg(
          "Não consegui recusar. O link pode ter expirado ou já foi usado.",
        );
        return;
      }

      setLoading(false);
      setOk(Boolean(data));
      setMsg(
        Boolean(data)
          ? "❌ Sugestão recusada. A barbearia vai entrar em contato ou sugerir outro horário."
          : "⚠️ Essa sugestão já foi respondida ou o link é inválido.",
      );
    }

    run();
  }, [supabase, id, token, canRun]);

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        <p className="text-xs text-white/60">Remarcação</p>
        <h1 className="mt-1 text-2xl font-black">Recusar sugestão</h1>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          {loading ? (
            <p className="text-white/70">Processando...</p>
          ) : (
            <>
              <p
                className={clsx(
                  "font-bold",
                  ok ? "text-emerald-300" : "text-yellow-200",
                )}
              >
                {ok ? "Feito" : "Atenção"}
              </p>
              <p className="mt-2 text-sm text-white/75">{msg}</p>
            </>
          )}
        </div>

        <a
          href="/"
          className="mt-5 h-12 w-full rounded-2xl bg-white/10 border border-white/10 grid place-items-center font-black hover:bg-white/15 transition"
        >
          Voltar
        </a>
      </div>
    </div>
  );
}
