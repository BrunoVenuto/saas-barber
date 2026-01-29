"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Params = { id: string };

type RescheduleContextRow = {
  appointment_id: string;
  barber_id: string;
  barbershop_id: string;
  service_id: string | null;
  duration_minutes: number;
  curr_date: string; // yyyy-mm-dd
  curr_start_time: string; // HH:mm:ss
};

type WorkingHourRow = {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  weekday: number;
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
};

type BusyTimeRow = {
  start_hhmm: string; // HH:mm
};

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function isUuid(v: string | null): v is string {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function toWeekday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay(); // 0..6
}

function toHHMM(t: string) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort(
    (a, b) => hhmmToMinutes(a) - hhmmToMinutes(b),
  );
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function waLink(raw: string | null) {
  const d0 = onlyDigits(raw || "");
  const d = d0.replace(/^0+/, "");
  if (!d) return null;
  const final = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${final}`;
}

export default function ReschedulePage() {
  const supabase = createClient();
  const { id } = useParams<Params>();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [loading, setLoading] = useState(true);
  const [busyLoading, setBusyLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  const [ctx, setCtx] = useState<RescheduleContextRow | null>(null);
  const [hours, setHours] = useState<WorkingHourRow[]>([]);
  const [busy, setBusy] = useState<string[]>([]);

  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const canRun = useMemo(() => isUuid(id) && isUuid(token), [id, token]);

  // Load contexto + working hours
  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      if (!canRun) {
        setLoading(false);
        setMsg("Link inválido. Verifique se o link está completo.");
        setCtx(null);
        setHours([]);
        return;
      }

      const [ctxRes, hoursRes] = await Promise.all([
        supabase.rpc("rpc_get_reschedule_context", {
          p_appointment_id: id,
          p_token: token,
        }),
        supabase.rpc("rpc_get_working_hours_for_reschedule", {
          p_appointment_id: id,
          p_token: token,
        }),
      ]);

      if (
        ctxRes.error ||
        !Array.isArray(ctxRes.data) ||
        ctxRes.data.length === 0
      ) {
        setLoading(false);
        setMsg(
          "Não consegui carregar o agendamento (token inválido ou expirado).",
        );
        setCtx(null);
        setHours([]);
        return;
      }

      const row = ctxRes.data[0] as RescheduleContextRow;
      setCtx(row);
      setNewDate(row.curr_date);
      setNewTime("");

      if (hoursRes.error) {
        setMsg("Não consegui carregar a agenda de horários.");
        setHours([]);
      } else {
        setHours(
          Array.isArray(hoursRes.data)
            ? (hoursRes.data as WorkingHourRow[])
            : [],
        );
      }

      setLoading(false);
    }

    load();
  }, [supabase, id, token, canRun]);

  // Load busy times when date changes
  useEffect(() => {
    async function loadBusy() {
      if (!canRun || !ctx || !newDate) return;

      setBusyLoading(true);
      setMsg(null);

      const { data, error } = await supabase.rpc("rpc_get_busy_times", {
        p_appointment_id: id,
        p_token: token,
        p_date: newDate,
      });

      if (error) {
        setBusy([]);
        setBusyLoading(false);
        setMsg("Erro ao carregar horários ocupados.");
        return;
      }

      const reserved = (Array.isArray(data) ? (data as BusyTimeRow[]) : [])
        .map((x) => x.start_hhmm)
        .filter(Boolean);

      setBusy(uniqSorted(reserved));
      setBusyLoading(false);
    }

    loadBusy();
  }, [supabase, id, token, canRun, ctx, newDate]);

  const slotMinutes = useMemo(() => {
    const d = ctx?.duration_minutes ?? 60;
    return d > 0 ? d : 60;
  }, [ctx?.duration_minutes]);

  const hoursForDate = useMemo(() => {
    if (!ctx || !newDate) return [];
    const wd = toWeekday(newDate);

    return hours.filter((h) => {
      if (Number(h.weekday) !== wd) return false;
      // (a RPC já trouxe geral+barbeiro, então aqui é só por dia)
      return true;
    });
  }, [hours, ctx, newDate]);

  const slots = useMemo(() => {
    if (!newDate || hoursForDate.length === 0) return [];

    const all: string[] = [];
    for (const h of hoursForDate) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));

      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        all.push(minutesToHHMM(t));
      }
    }

    const unique = uniqSorted(all);
    return unique.filter((t) => !busy.includes(t));
  }, [newDate, hoursForDate, slotMinutes, busy]);

  async function submitSuggestion() {
    if (!canRun || !ctx) return;

    setMsg(null);

    if (!newDate) return setMsg("Selecione uma data.");
    if (!newTime) return setMsg("Selecione um horário.");

    if (busy.includes(newTime)) {
      setMsg("Esse horário já foi ocupado. Escolha outro.");
      setNewTime("");
      return;
    }

    const startMin = hhmmToMinutes(newTime);
    const endMin = startMin + slotMinutes;

    const proposed_start = newTime; // HH:mm
    const proposed_end = minutesToHHMM(endMin); // HH:mm

    setSubmitting(true);

    const { data, error } = await supabase.rpc(
      "rpc_create_reschedule_request",
      {
        p_appointment_id: id,
        p_token: token,
        p_proposed_date: newDate,
        p_proposed_start: `${proposed_start}:00`,
        p_proposed_end: `${proposed_end}:00`,
      },
    );

    if (error || !Array.isArray(data) || data.length === 0) {
      setSubmitting(false);
      setMsg(
        "Não consegui criar a sugestão. Verifique o link e tente novamente.",
      );
      return;
    }

    const created = data[0] as { request_id: string; request_token: string };

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const acceptUrl = `${baseUrl}/reschedule-request/${created.request_id}/accept?token=${created.request_token}`;
    const declineUrl = `${baseUrl}/reschedule-request/${created.request_id}/decline?token=${created.request_token}`;

    // Buscar telefone/nome do cliente via RPC segura
    const apptRes = await supabase.rpc("rpc_get_appointment_by_token", {
      p_appointment_id: id,
      p_token: token,
    });

    const apptRow =
      Array.isArray(apptRes.data) && apptRes.data.length > 0
        ? (apptRes.data[0] as {
            client_name: string | null;
            client_phone: string | null;
          })
        : null;

    const phoneDigits = apptRow?.client_phone
      ? onlyDigits(apptRow.client_phone)
      : "";
    const wa = waLink(phoneDigits || null);

    if (!wa) {
      setSubmitting(false);
      setMsg("Sugestão criada, mas o WhatsApp do cliente não está válido.");
      return;
    }

    const text =
      `*Sugestão de novo horário*\n\n` +
      `Cliente: ${apptRow?.client_name || "—"}\n` +
      `Data sugerida: ${newDate}\n` +
      `Horário sugerido: ${proposed_start}\n\n` +
      `✅ Aceitar:\n${acceptUrl}\n\n` +
      `❌ Recusar:\n${declineUrl}`;

    const link = `${wa}?text=${encodeURIComponent(text)}`;
    window.open(link, "_blank", "noopener,noreferrer");

    setSubmitting(false);
    setMsg("Sugestão enviada para o cliente no WhatsApp.");
  }

  // UI
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="min-h-screen bg-black text-white px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
          <p className="text-xs text-white/60">Remarcação</p>
          <h1 className="mt-1 text-2xl font-black">Sugerir outro horário</h1>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-white/80">{msg || "Link inválido."}</p>
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

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        <p className="text-xs text-white/60">Remarcação</p>
        <h1 className="mt-1 text-2xl font-black">Sugerir outro horário</h1>
        <p className="mt-2 text-sm text-white/60">
          Selecione um dia e escolha um horário{" "}
          <span className="text-white/85 font-bold">livre</span>. Depois envie
          para o cliente confirmar.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/70">
            Atual:{" "}
            <span className="font-bold text-white/90">{ctx.curr_date}</span> •{" "}
            <span className="font-bold text-white/90">
              {toHHMM(ctx.curr_start_time)}
            </span>
            <span className="text-white/50"> • </span>
            <span className="text-white/75">{slotMinutes} min</span>
          </p>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-white/85">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <label className="text-sm font-bold text-white/80">Nova data</label>
          <input
            type="date"
            className="mt-2 w-full rounded-2xl bg-black/40 border border-white/10 px-3 py-3 outline-none"
            value={newDate}
            onChange={(e) => {
              setNewDate(e.target.value);
              setNewTime("");
            }}
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white/80">Horários livres</p>
            <p className="text-xs text-white/55">
              {busyLoading ? "Carregando..." : `${slots.length} opções`}
            </p>
          </div>

          {!newDate ? (
            <p className="mt-2 text-white/60 text-sm">Selecione uma data.</p>
          ) : busyLoading ? (
            <p className="mt-2 text-white/60 text-sm">Carregando horários...</p>
          ) : hoursForDate.length === 0 ? (
            <p className="mt-2 text-white/60 text-sm">
              Sem horários configurados para esse dia.
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-white/60 text-sm">
              Nenhum horário livre nesse dia.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {slots.map((t) => {
                const selected = newTime === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTime(t)}
                    className={clsx(
                      "h-12 rounded-2xl font-black border transition",
                      selected
                        ? "bg-yellow-400 text-black border-yellow-300"
                        : "bg-white/10 text-white border-white/10 hover:bg-white/15",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={submitSuggestion}
            disabled={submitting || !newDate || !newTime}
            className={clsx(
              "mt-5 w-full h-12 rounded-2xl font-black transition",
              "bg-emerald-500 text-black hover:brightness-110",
              "disabled:opacity-50 disabled:hover:brightness-100",
            )}
          >
            {submitting ? "Enviando..." : "Enviar sugestão ao cliente"}
          </button>

          <p className="mt-3 text-xs text-white/55">
            Isso abre o WhatsApp com links de <b>aceitar</b> ou <b>recusar</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
