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
};

function toHHMM(t?: string | null) {
  if (!t) return "";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

const ALLOWED_TO_CONFIRM = [
  "pending",
  "reschedule_requested",
  "reschedule_pending",
  "suggested",
  "suggested_time",
  "waiting_client",
  "awaiting_client",
] as const;

function isAllowedStatus(status: string | null) {
  const st = String(status || "").toLowerCase();
  return ALLOWED_TO_CONFIRM.includes(st as (typeof ALLOWED_TO_CONFIRM)[number]);
}

export default function ConfirmAppointmentPage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const id = params?.id;
  const token = (search.get("token") || "").trim();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "success" | "warning" | "error">(
    "idle",
  );

  const tokenOk = useMemo(() => token.length >= 16, [token]);

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

      if (!tokenOk) {
        setMode("error");
        setMsg("Link inválido (token ausente).");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("appointments")
        .select("id,status,action_token,date,start_time,end_time,client_name")
        .eq("id", id)
        .eq("action_token", token)
        .single();

      if (error || !data) {
        setMode("warning");
        setMsg("Esse link é inválido ou já foi usado.");
        setAppt(null);
        setLoading(false);
        return;
      }

      const a = data as Appointment;

      if (!isAllowedStatus(a.status)) {
        setMode("warning");
        setMsg(
          "Esse agendamento já foi confirmado/cancelado ou o link é inválido.",
        );
        setAppt(a);
        setLoading(false);
        return;
      }

      setAppt(a);
      setMode("idle");
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function handleConfirm() {
    if (!id || !tokenOk || !appt) return;

    setSubmitting(true);
    setMsg(null);

    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", id)
      .eq("action_token", token)
      .in("status", [...ALLOWED_TO_CONFIRM]);

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
            CLIENTE
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black">
            Confirmar horário
          </h1>
          <p className="mt-2 text-white/65 text-sm">
            Confirme somente se esse horário ficou ok pra você.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
              Carregando...
            </div>
          ) : (
            <>
              {!!appt && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

              {msg && (
                <div
                  className={clsx(
                    "mt-4 rounded-2xl border p-4",
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
                  <p className="font-bold">Status</p>
                  <p className="text-sm mt-1">{msg}</p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {mode === "idle" && isAllowedStatus(appt?.status ?? null) && (
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className={clsx(
                      "h-12 w-full rounded-2xl font-black text-black transition",
                      "bg-yellow-400 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100",
                      "shadow-[0_0_0_1px_rgba(255,220,120,0.35),0_18px_55px_rgba(0,0,0,0.65)]",
                    )}
                  >
                    {submitting ? "Confirmando..." : "Confirmar"}
                  </button>
                )}

                <a
                  href="/"
                  className="h-12 w-full rounded-2xl font-black grid place-items-center bg-white/10 border border-white/10 hover:bg-white/15 transition"
                >
                  Voltar
                </a>

                <p className="text-[11px] text-white/45 text-center">
                  Se você abriu isso por engano, pode fechar.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
