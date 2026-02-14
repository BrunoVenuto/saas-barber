"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Appointment = {
  id: string;
  date: string; // yyyy-mm-dd
  start_time: string; // HH:mm:ss ou HH:mm
  end_time: string;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  service_name: string | null;
};

type AppointmentDbRow = {
  id: unknown;
  date: unknown;
  start_time: unknown;
  end_time: unknown;
  status: unknown;
  client_name?: unknown;
  client_phone?: unknown;
  services?: { name?: unknown } | null;
};

function hhmm(t: string) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function statusLabel(status: string) {
  if (status === "done" || status === "completed") return "Concluído";
  if (status === "canceled" || status === "cancelled") return "Cancelado";
  if (status === "confirmed") return "Confirmado";
  if (status === "pending" || status === "scheduled") return "Pendente";
  return status;
}

export default function BarbeiroHistoricoPage() {
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    setLoading(true);
    setMsg(null);

    // 1) Usuário logado
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      setMsg(userErr.message);
      setAppointments([]);
      setLoading(false);
      return;
    }

    if (!user) {
      setMsg("Você precisa estar logado como barbeiro.");
      setAppointments([]);
      setLoading(false);
      return;
    }

    // 2) Descobrir barbeiro (alinhado com suas APIs: barbers.profile_id = user.id)
    const { data: barber, error: barberErr } = await supabase
      .from("barbers")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (barberErr || !barber) {
      setMsg(
        "Barbeiro não vinculado ao usuário. Verifique barbers.profile_id."
      );
      setAppointments([]);
      setLoading(false);
      return;
    }

    // 3) Buscar histórico (done + canceled)
    // inclui "cancelled" caso exista legado
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
          id,
          date,
          start_time,
          end_time,
          status,
          client_name,
          client_phone,
          services:service_id ( name )
        `
      )
      .eq("barber_id", barber.id)
      .in("status", ["done", "canceled", "cancelled"])
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      setMsg("Erro ao buscar histórico: " + error.message);
      setAppointments([]);
      setLoading(false);
      return;
    }

    if (!Array.isArray(data)) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const mapped: Appointment[] = (data as AppointmentDbRow[]).map((a) => ({
      id: String(a.id),
      date: String(a.date),
      start_time: String(a.start_time),
      end_time: String(a.end_time),
      status: String(a.status),
      client_name:
        a.client_name === undefined || a.client_name === null
          ? null
          : String(a.client_name),
      client_phone:
        a.client_phone === undefined || a.client_phone === null
          ? null
          : String(a.client_phone),
      service_name: a.services?.name ? String(a.services.name) : null,
    }));

    setAppointments(mapped);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando histórico...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">
              📜 Histórico de atendimentos
            </h1>
            <p className="text-zinc-400 mt-2 text-sm sm:text-base">
              Concluídos e cancelados.
            </p>
          </div>

          <button
            onClick={loadHistory}
            className="h-11 px-5 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.02] transition"
          >
            Atualizar
          </button>
        </header>

        {msg && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4">
            {msg}
          </div>
        )}

        {appointments.length === 0 && (
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 text-zinc-400">
            Nenhum atendimento no histórico.
          </div>
        )}

        <section className="space-y-3">
          {appointments.map((a) => {
            const isDone = a.status === "done" || a.status === "completed";
            const isCanceled = a.status === "canceled" || a.status === "cancelled";

            return (
              <div
                key={a.id}
                className="bg-zinc-950 border border-white/10 rounded-2xl p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-200 font-bold">
                        {a.date} • {hhmm(a.start_time)} - {hhmm(a.end_time)}
                      </span>

                      <span className="text-zinc-500">•</span>

                      <span
                        className={`font-black ${
                          isDone
                            ? "text-emerald-300"
                            : isCanceled
                            ? "text-red-400"
                            : "text-zinc-300"
                        }`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </div>

                    <div className="text-sm text-zinc-400">
                      Cliente:{" "}
                      <span className="text-zinc-200 font-semibold">
                        {a.client_name || "—"}
                      </span>{" "}
                      • Tel:{" "}
                      <span className="text-zinc-200 font-semibold">
                        {a.client_phone || "—"}
                      </span>
                    </div>

                    <div className="text-sm text-zinc-400">
                      Serviço:{" "}
                      <span className="text-zinc-200 font-semibold">
                        {a.service_name || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
