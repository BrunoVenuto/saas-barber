"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Barber = { id: string; name: string; barbershop_id: string | null };

type ServiceMini = { id: string; name: string; duration_minutes: number | null };

type AppointmentRow = {
  id: string;
  date: string; // yyyy-mm-dd
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  status: string;
  barber_id: string;
  service_id: string | null;
  client_name: string | null;
  client_phone: string | null;
};

type AppointmentUI = AppointmentRow & {
  barbers?: { name: string } | null;
  services?: { name: string; duration_minutes: number } | null;
};

function hhmm(t?: string | null) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function toWhatsAppDigits(phone: string) {
  const d = onlyDigits(phone);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminAgendaPage() {
  const supabase = createClient();

  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<AppointmentUI[]>([]);

  const [barberId, setBarberId] = useState<string>("all");
  const [date, setDate] = useState<string>(todayYmd());
  const [status, setStatus] = useState<string>("all");

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 0) barbershop_id do admin logado
  useEffect(() => {
    (async () => {
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        setError(userErr.message);
        return;
      }

      if (!user) {
        setError("Você precisa estar logado.");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .single();

      if (pErr) {
        setError("Erro ao carregar profile: " + pErr.message);
        return;
      }

      if (profile?.role !== "admin") {
        setError("Acesso negado: você não é admin dessa barbearia.");
        return;
      }

      if (!profile?.barbershop_id) {
        setError("Seu usuário não está vinculado a nenhuma barbearia (barbershop_id = null).");
        return;
      }

      setBarbershopId(profile.barbershop_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1) Load barbers (somente da barbearia)
  useEffect(() => {
    if (!barbershopId) return;

    (async () => {
      setError(null);

      const { data, error } = await supabase
        .from("barbers")
        .select("id, name, barbershop_id")
        .eq("barbershop_id", barbershopId)
        .order("name", { ascending: true });

      if (error) {
        setError("Erro ao carregar barbeiros: " + error.message);
        return;
      }

      setBarbers((data as Barber[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId]);

  // 2) Load appointments sem JOIN embutido (evita erro de relationship)
  async function loadAppointments() {
    if (!barbershopId) return;

    setLoading(true);
    setError(null);

    const barberIds = barbers.map((b) => b.id);

    // Se ainda não carregou barbeiros, ou barbearia sem barbeiros
    if (barberIds.length === 0) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    let q = supabase
      .from("appointments")
      .select("id,date,start_time,end_time,status,barber_id,service_id,client_name,client_phone")
      .eq("date", date)
      .in("barber_id", barberIds)
      .order("start_time", { ascending: true });

    if (barberId !== "all") q = q.eq("barber_id", barberId);
    if (status !== "all") q = q.eq("status", status);

    const { data, error } = await q;

    if (error) {
      setError("Erro ao carregar agendamentos: " + error.message);
      setAppointments([]);
      setLoading(false);
      return;
    }

    const rows: AppointmentRow[] = (data as any[]) || [];

    // Buscar serviços (para nome/duração)
    const serviceIds = Array.from(
      new Set(rows.map((r) => r.service_id).filter(Boolean) as string[])
    );

    let servicesMap = new Map<string, ServiceMini>();
    if (serviceIds.length > 0) {
      const { data: sData, error: sErr } = await supabase
        .from("services")
        .select("id,name,duration_minutes")
        .in("id", serviceIds);

      if (!sErr && sData) {
        (sData as any[]).forEach((s) => {
          servicesMap.set(s.id, {
            id: s.id,
            name: s.name,
            duration_minutes: s.duration_minutes ?? null,
          });
        });
      }
    }

    // Map de barbeiros
    const barbersMap = new Map<string, Barber>();
    barbers.forEach((b) => barbersMap.set(b.id, b));

    // Monta UI igual antes (barbers/services como objetos)
    const ui: AppointmentUI[] = rows.map((r) => {
      const b = barbersMap.get(r.barber_id);
      const s = r.service_id ? servicesMap.get(r.service_id) : null;

      return {
        ...r,
        barbers: b ? { name: b.name } : null,
        services: s
          ? { name: s.name, duration_minutes: Number(s.duration_minutes ?? 0) }
          : null,
      };
    });

    setAppointments(ui);
    setLoading(false);
  }

  // Recarrega quando muda filtros ou quando lista de barbeiros chega
  useEffect(() => {
    if (!barbershopId) return;
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId, barbers, barberId, date, status]);

  // 3) Update status
  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    setError(null);

    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", id);

    if (error) {
      setError("Erro ao atualizar: " + error.message);
      setUpdatingId(null);
      return;
    }

    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    setUpdatingId(null);
  }

  function openWhatsApp(ap: AppointmentUI) {
    const phone = ap.client_phone ? toWhatsAppDigits(ap.client_phone) : "";
    if (!phone) {
      alert("Esse agendamento não tem telefone do cliente.");
      return;
    }

    const msg = `Olá, ${ap.client_name || "tudo bem?"}! ✅
Seu agendamento:
📅 ${ap.date}
🕒 ${hhmm(ap.start_time)} - ${hhmm(ap.end_time)}
💈 ${ap.services?.name || "Serviço"}
Barbeiro: ${ap.barbers?.name || "—"}
Status: ${ap.status}

Se precisar ajustar, responde aqui.`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // 4) Resumo
  const summary = useMemo(() => {
    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === "pending" || a.status === "scheduled").length;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const completed = appointments.filter((a) => a.status === "completed").length;
    const canceled = appointments.filter((a) => a.status === "canceled").length;
    return { total, pending, confirmed, completed, canceled };
  }, [appointments]);

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black">
              Agenda <span className="text-yellow-400">Admin</span>
            </h1>
            <p className="text-zinc-400 mt-2">Controle da sua barbearia — filtros, status e atendimento.</p>
          </div>

          <button
            onClick={loadAppointments}
            disabled={!barbershopId}
            className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.02] transition disabled:opacity-50"
          >
            Atualizar
          </button>
        </header>

        {/* FILTERS */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <label className="block text-sm text-zinc-400 mb-2">Barbeiro</label>
            <select
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              disabled={!barbershopId}
            >
              <option value="all">Todos</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <label className="block text-sm text-zinc-400 mb-2">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              disabled={!barbershopId}
            />
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <label className="block text-sm text-zinc-400 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-3 rounded bg-zinc-900 border border-white/10"
              disabled={!barbershopId}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
              <option value="completed">Concluído</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>
        </section>

        {/* SUMMARY */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Total</p>
            <p className="text-2xl font-black">{summary.total}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Pendentes</p>
            <p className="text-2xl font-black text-yellow-300">{summary.pending}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Confirmados</p>
            <p className="text-2xl font-black text-green-400">{summary.confirmed}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Concluídos</p>
            <p className="text-2xl font-black">{summary.completed}</p>
          </div>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Cancelados</p>
            <p className="text-2xl font-black text-red-400">{summary.canceled}</p>
          </div>
        </section>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* LIST */}
        <section className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-black">
              Agendamentos — <span className="text-yellow-400">{date}</span>
            </h2>
            {loading && <span className="text-zinc-400">Carregando...</span>}
          </div>

          <div className="p-4 md:p-6 space-y-3">
            {!loading && appointments.length === 0 && (
              <div className="text-zinc-400">Nenhum agendamento encontrado.</div>
            )}

            {appointments.map((ap) => (
              <div
                key={ap.id}
                className="border border-white/10 rounded-xl p-4 md:p-5 bg-black/30"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-green-700/20 border border-green-500/20 text-green-300 font-bold">
                        {hhmm(ap.start_time)} - {hhmm(ap.end_time)}
                      </span>

                      <span className="text-zinc-300">
                        <span className="font-semibold">{ap.services?.name || "Serviço"}</span>
                      </span>

                      <span className="text-zinc-500">•</span>

                      <span className="text-zinc-300">
                        Barbeiro:{" "}
                        <span className="text-white font-semibold">{ap.barbers?.name || "—"}</span>
                      </span>

                      <span className="text-zinc-500">•</span>

                      <span
                        className={`font-black ${
                          ap.status === "confirmed"
                            ? "text-green-400"
                            : ap.status === "pending" || ap.status === "scheduled"
                            ? "text-yellow-300"
                            : ap.status === "completed"
                            ? "text-white"
                            : ap.status === "canceled"
                            ? "text-red-400"
                            : "text-zinc-300"
                        }`}
                      >
                        {ap.status === "scheduled" ? "pending" : ap.status}
                      </span>
                    </div>

                    <div className="text-sm text-zinc-400">
                      Cliente:{" "}
                      <span className="text-zinc-200 font-semibold">{ap.client_name || "—"}</span>{" "}
                      • Tel:{" "}
                      <span className="text-zinc-200 font-semibold">{ap.client_phone || "—"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={updatingId === ap.id}
                      onClick={() => updateStatus(ap.id, "confirmed")}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-black transition disabled:opacity-50"
                    >
                      ✅ Confirmar
                    </button>

                    <button
                      disabled={updatingId === ap.id}
                      onClick={() => updateStatus(ap.id, "completed")}
                      className="px-4 py-2 rounded-lg bg-zinc-200 hover:bg-white text-black font-black transition disabled:opacity-50"
                    >
                      🏁 Concluir
                    </button>

                    <button
                      disabled={updatingId === ap.id}
                      onClick={() => updateStatus(ap.id, "canceled")}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black transition disabled:opacity-50"
                    >
                      ❌ Cancelar
                    </button>

                    <button
                      onClick={() => openWhatsApp(ap)}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black transition"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
