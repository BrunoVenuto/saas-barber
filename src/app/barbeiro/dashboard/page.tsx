"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Barber = {
  id: string;
  name: string;
};

type Appointment = {
  id: string;
  date: string; // yyyy-mm-dd
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string; // HH:mm:ss or HH:mm
  status: "pending" | "confirmed" | "canceled" | string;
  client_name?: string | null;
  client_phone?: string | null;
  service_name?: string | null;
};

const CANCEL_MINUTES_NOTICE = 60; // antecedência mínima p/ permitir cancelamento

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

/**
 * WhatsApp:
 * - Se vier 10/11 dígitos (DDD+num BR), prefixa 55
 * - Se já vier com 55, mantém
 * - Se vier internacional diferente, mantém do jeito que vier (sem forçar)
 */
function toWhatsAppDigits(phone: string) {
  const d = onlyDigits(phone);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function hhmm(t: string) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function todayYmd() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Converte (date yyyy-mm-dd + start_time HH:mm[:ss]) para Date local
function toLocalDateTime(dateISO: string, time: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const hh = Number(time.slice(0, 2));
  const mm = Number(time.slice(3, 5));
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// Diferença em minutos entre agora e o horário do agendamento (positivo = falta tempo)
function minutesUntil(ap: Appointment) {
  const start = toLocalDateTime(ap.date, ap.start_time);
  const now = new Date();
  return Math.floor((start.getTime() - now.getTime()) / 60000);
}

export default function BarberDashboardPage() {
  const supabase = createClient();

  const [barber, setBarber] = useState<Barber | null>(null);
  const [day, setDay] = useState<string>(todayYmd());

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // --------------------------
  // Load barber linked to user
  // ✅ CORRIGIDO: usa barbers.user_id
  // --------------------------
  useEffect(() => {
    (async () => {
      setStatusMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        setStatusMsg(userErr.message);
        return;
      }

      if (!user) {
        setStatusMsg("Você precisa estar logado como barbeiro.");
        return;
      }

      const b = await supabase
        .from("barbers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (b.error) {
        setStatusMsg("Erro ao buscar barbeiro: " + b.error.message);
        return;
      }

      if (!b.data) {
        setStatusMsg(
          "Não encontrei o barbeiro vinculado a esse login. Verifique se barbers.user_id está preenchido."
        );
        return;
      }

      setBarber({ id: b.data.id, name: b.data.name });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------
  // Load appointments
  // --------------------------
  async function loadAppointments(selectedDay: string, barberId: string) {
    setLoading(true);
    setStatusMsg(null);

    const res = await supabase
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
      .eq("barber_id", barberId)
      .eq("date", selectedDay)
      .order("start_time", { ascending: true });

    if (res.error) {
      setStatusMsg(res.error.message);
      setAppointments([]);
      setLoading(false);
      return;
    }

    const mapped: Appointment[] = (res.data || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      // normaliza status antigo scheduled -> pending
      status: a.status === "scheduled" ? "pending" : a.status,
      client_name: a.client_name ?? null,
      client_phone: a.client_phone ?? null,
      service_name: a.services?.name ?? null,
    }));

    setAppointments(mapped);
    setLoading(false);
  }

  useEffect(() => {
    if (!barber) return;
    loadAppointments(day, barber.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id, day]);

  // --------------------------
  // WhatsApp helper
  // --------------------------
  function openWhatsAppConfirm(ap: Appointment) {
    const phone = ap.client_phone ? toWhatsAppDigits(ap.client_phone) : "";
    if (!phone) {
      alert("Esse agendamento não tem telefone do cliente.");
      return false;
    }

    const msg = `Olá, ${ap.client_name || "tudo bem?"}! ✅
Confirmando seu agendamento:
📅 ${ap.date}
🕒 ${hhmm(ap.start_time)} - ${hhmm(ap.end_time)}
💈 ${ap.service_name || "Serviço"}

Está tudo certo?`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    return true;
  }

  function openWhatsAppCancel(ap: Appointment) {
    const phone = ap.client_phone ? toWhatsAppDigits(ap.client_phone) : "";
    if (!phone) {
      alert("Esse agendamento não tem telefone do cliente.");
      return false;
    }

    const msg = `Olá, ${ap.client_name || "tudo bem?"}!
⚠️ Precisamos cancelar seu agendamento.

📅 ${ap.date}
🕒 ${hhmm(ap.start_time)} - ${hhmm(ap.end_time)}
💈 ${ap.service_name || "Serviço"}

Se quiser, me diga um novo horário que eu já remarco pra você. ✅`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    return true;
  }

  // --------------------------
  // API Status update (server)
  // --------------------------
  async function confirmAppointment(ap: Appointment) {
    if (!barber) return;

    setUpdatingId(ap.id);
    setStatusMsg(null);

    // 1) abre WhatsApp primeiro
    openWhatsAppConfirm(ap);

    // 2) confirma no banco via API
    const res = await fetch(`/api/barbeiro/appointments/${ap.id}/confirm`, {
      method: "POST",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setStatusMsg("Erro ao confirmar: " + (json?.error || "Falha na API"));
      setUpdatingId(null);
      return;
    }

    setAppointments((prev) =>
      prev.map((a) => (a.id === ap.id ? { ...a, status: "confirmed" } : a))
    );

    setUpdatingId(null);
  }

  async function cancelAppointment(ap: Appointment) {
    if (!barber) return;

    // regra de antecedência
    const mins = minutesUntil(ap);
    if (mins < CANCEL_MINUTES_NOTICE) {
      alert(
        `Cancelamento permitido somente com antecedência mínima de ${CANCEL_MINUTES_NOTICE} minutos.\n` +
          `Faltam ${Math.max(mins, 0)} minutos para o horário.`
      );
      return;
    }

    const ok = confirm(
      `Cancelar este agendamento?\n\n` +
        `⚠️ Isso vai avisar o cliente no WhatsApp e marcar como canceled no sistema.`
    );
    if (!ok) return;

    setUpdatingId(ap.id);
    setStatusMsg(null);

    // 1) avisa WhatsApp
    openWhatsAppCancel(ap);

    // 2) cancela via API
    const res = await fetch(`/api/barbeiro/appointments/${ap.id}/cancel`, {
      method: "POST",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setStatusMsg("Erro ao cancelar: " + (json?.error || "Falha na API"));
      setUpdatingId(null);
      return;
    }

    setAppointments((prev) =>
      prev.map((a) => (a.id === ap.id ? { ...a, status: "canceled" } : a))
    );

    setUpdatingId(null);
  }

  // --------------------------
  // Summary
  // --------------------------
  const summary = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const pending = appointments.filter((a) => a.status === "pending").length;
    const canceled = appointments.filter((a) => a.status === "canceled").length;

    return { total, confirmed, pending, canceled };
  }, [appointments]);

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black">
              Minha <span className="text-yellow-400">agenda</span>
            </h1>
            <p className="text-zinc-400 mt-2">
              Barbeiro:{" "}
              <span className="text-white font-semibold">
                {barber?.name || "carregando..."}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
              <label className="block text-sm text-zinc-400 mb-2">Dia</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <button
              onClick={() => barber && loadAppointments(day, barber.id)}
              className="h-[78px] px-5 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.02] transition"
            >
              Atualizar
            </button>
          </div>
        </header>

        {/* SUMMARY */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total</p>
            <p className="text-2xl font-black">{summary.total}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Pendentes</p>
            <p className="text-2xl font-black text-yellow-300">{summary.pending}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Confirmados</p>
            <p className="text-2xl font-black text-green-400">{summary.confirmed}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Cancelados</p>
            <p className="text-2xl font-black text-red-400">{summary.canceled}</p>
          </div>
        </section>

        {/* STATUS MSG */}
        {statusMsg && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4">
            {statusMsg}
          </div>
        )}

        {/* LIST */}
        <section className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-black">
              Agendamentos do dia <span className="text-yellow-400">{day}</span>
            </h2>
            {loading && <span className="text-zinc-400">Carregando...</span>}
          </div>

          <div className="p-4 md:p-6 space-y-3">
            {!loading && appointments.length === 0 && (
              <div className="text-zinc-400">Nenhum agendamento nesse dia.</div>
            )}

            {appointments.map((ap) => {
              const mins = minutesUntil(ap);
              const canCancel =
                mins >= CANCEL_MINUTES_NOTICE && ap.status !== "canceled";

              return (
                <div
                  key={ap.id}
                  className="border border-white/10 rounded-xl p-4 md:p-5 bg-black/30"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-green-700/20 border border-green-500/20 text-green-300 font-bold">
                          {hhmm(ap.start_time)} - {hhmm(ap.end_time)}
                        </span>

                        <span className="text-zinc-300">
                          {ap.service_name ? (
                            <span className="font-semibold">{ap.service_name}</span>
                          ) : (
                            <span className="opacity-60">Serviço</span>
                          )}
                        </span>

                        <span className="text-zinc-500">•</span>

                        <span
                          className={`font-bold ${
                            ap.status === "confirmed"
                              ? "text-green-400"
                              : ap.status === "pending"
                              ? "text-yellow-300"
                              : ap.status === "canceled"
                              ? "text-red-400"
                              : "text-zinc-300"
                          }`}
                        >
                          {ap.status === "scheduled" ? "pending" : ap.status}
                        </span>

                        {ap.status !== "canceled" && (
                          <span className="text-xs text-zinc-500 ml-2">
                            {mins >= 0 ? `Faltam ${mins} min` : `Já passou`}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-zinc-400">
                        Cliente:{" "}
                        <span className="text-zinc-200 font-semibold">
                          {ap.client_name || "—"}
                        </span>{" "}
                        • Tel:{" "}
                        <span className="text-zinc-200 font-semibold">
                          {ap.client_phone || "—"}
                        </span>
                      </div>

                      {!canCancel && ap.status !== "canceled" && (
                        <div className="text-xs text-amber-300 mt-1">
                          ⚠️ Cancelamento só com {CANCEL_MINUTES_NOTICE} min de antecedência.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={updatingId === ap.id || ap.status === "confirmed"}
                        onClick={() => confirmAppointment(ap)}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-black transition disabled:opacity-50"
                      >
                        ✅ Confirmar
                      </button>

                      <button
                        disabled={updatingId === ap.id || !canCancel}
                        onClick={() => cancelAppointment(ap)}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black transition disabled:opacity-50"
                      >
                        ❌ Cancelar
                      </button>

                      <button
                        onClick={() => openWhatsAppConfirm(ap)}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black transition"
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
