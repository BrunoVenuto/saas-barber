"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Appointment = {
  id: string;
  status: string | null;
  action_token: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  client_name: string | null;
  client_phone: string | null;
  barber_id: string | null;
  service_id: string | null;
};

function toHHMM(t?: string | null) {
  if (!t) return "";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function ConfirmAppointmentPage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const id = params?.id;
  const token = search.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "success" | "warning" | "error">(
    "idle",
  );

  const isTokenValid = useMemo(() => token.trim().length >= 16, [token]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      if (!id) {
        setMode("error");
        setMsg("Link inválido (id ausente).");
        setLoading(false);
        return;
      }

      if (!isTokenValid) {
        setMode("error");
        setMsg("Link inválido (token ausente).");
        setLoading(false);
        return;
      }

      // ✅ Busca pelo ID + token (não vaza dado se token não bate)
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id,status,action_token,date,start_time,end_time,client_name,client_phone,barber_id,service_id",
        )
        .eq("id", id)
        .eq("action_token", token)
        .single();

      if (error || !data) {
        setMode("warning");
        setMsg(
          "Esse agendamento já foi confirmado/cancelado ou o link é inválido.",
        );
        setAppt(null);
        setLoading(false);
        return;
      }

      setAppt(data as Appointment);

      // ✅ Aceita PENDING como estado correto (é o que você grava)
      const st = String(data.status || "").toLowerCase();
      if (st !== "pending") {
        setMode("warning");
        setMsg(
          "Esse agendamento já foi confirmado/cancelado ou o link é inválido.",
        );
        setLoading(false);
        return;
      }

      setMode("idle");
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function handleConfirm() {
    if (!id || !token || !appt) return;

    setSubmitting(true);
    setMsg(null);

    // ✅ Atualiza apenas se id+token baterem e status ainda for pending
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
      })
      .eq("id", id)
      .eq("action_token", token)
      .eq("status", "pending");

    if (error) {
      setMode("error");
      setMsg("Erro ao confirmar: " + error.message);
      setSubmitting(false);
      return;
    }

    setMode("success");
    setMsg("✅ Agendamento confirmado com sucesso.");
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_25px_90px_rgba(0,0,0,0.65)] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-white/10">
          <p className="text-xs tracking-[0.22em] font-black text-white/60">
            Confirmação
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black">
            Confirmar agendamento
          </h1>
          <p className="mt-2 text-white/65 text-sm">
            Abra esse link apenas se você for o barbeiro responsável.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
              Carregando...
            </div>
          ) : (
            <>
              {msg && (
                <div
                  className={clsx(
                    "rounded-2xl border p-4",
                    mode === "success" &&
                      "bg-emerald-500/10 border-emerald-400/30 text-emerald-200",
                    mode === "warning" &&
                      "bg-yellow-500/10 border-yellow-400/30 text-yellow-200",
                    mode === "error" &&
                      "bg-red-500/10 border-red-400/30 text-red-200",
                    mode === "idle" &&
                      "bg-white/5 border-white/10 text-white/80",
                  )}
                >
                  <p className="font-bold">Atenção</p>
                  <p className="text-sm mt-1">{msg}</p>
                </div>
              )}

              {mode === "idle" && appt && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/55">Detalhes</p>
                  <div className="mt-2 space-y-1 text-white/85">
                    <p>
                      <span className="text-white/55">Cliente:</span>{" "}
                      <span className="font-bold">
                        {appt.client_name || "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-white/55">Data:</span>{" "}
                      <span className="font-bold">{appt.date || "—"}</span>
                    </p>
                    <p>
                      <span className="text-white/55">Horário:</span>{" "}
                      <span className="font-bold">
                        {toHHMM(appt.start_time)}
                        {appt.end_time ? ` - ${toHHMM(appt.end_time)}` : ""}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {mode === "idle" && (
                  <button
                    onClick={handleConfirm}
                    disabled={submitting || !appt}
                    className={clsx(
                      "h-12 w-full rounded-2xl font-black text-black transition",
                      "bg-yellow-400 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100",
                      "shadow-[0_0_0_1px_rgba(255,220,120,0.35),0_18px_55px_rgba(0,0,0,0.65)]",
                    )}
                  >
                    {submitting ? "Confirmando..." : "Confirmar agora"}
                  </button>
                )}

                <a
                  href="/"
                  className="h-12 w-full rounded-2xl font-black grid place-items-center bg-white/10 border border-white/10 hover:bg-white/15 transition"
                >
                  Voltar
                </a>

                <p className="text-[11px] text-white/45 text-center">
                  Se você abriu isso por engano, ignore. Se tiver dúvida, fale
                  com a barbearia.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
