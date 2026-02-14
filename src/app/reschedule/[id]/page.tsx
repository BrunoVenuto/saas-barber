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

type WorkingHour = {
  id: string;
  barber_id: string | null;
  weekday: number | string;
  start_time: string;
  end_time: string;
};

type BusyRow = {
  start_time: string;
};

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

function toHHMM(t?: string | null) {
  if (!t) return "";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
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

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function ReschedulePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const id = params?.id;
  const token = (search.get("token") || "").trim();

  const [loading, setLoading] = useState(true);
  const [busyLoading, setBusyLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [msgMode, setMsgMode] = useState<
    "info" | "success" | "warning" | "error"
  >("info");

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [busy, setBusy] = useState<string[]>([]);

  const [date, setDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const tokenOk = useMemo(() => token.length >= 16, [token]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);
      setSelectedTime("");
      setDate("");

      if (!id || !tokenOk) {
        setMsgMode("error");
        setMsg("Link inválido (id/token ausente).");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id,status,action_token,date,start_time,end_time,client_name,client_phone,barber_id,service_id",
        )
        .eq("id", id)
        .eq("action_token", token)
        .single();

      if (error || !data) {
        setMsgMode("warning");
        setMsg("Link inválido ou já utilizado.");
        setLoading(false);
        return;
      }

      const a = data as Appointment;
      setAppt(a);

      // pré-seleciona a data atual do agendamento pra facilitar
      setDate(a.date || "");

      const { data: hData, error: hErr } = await supabase
        .from("working_hours")
        .select("id,barber_id,weekday,start_time,end_time")
        .eq("barber_id", a.barber_id);

      if (hErr) {
        setMsgMode("warning");
        setMsg("Não consegui carregar horários de trabalho do barbeiro.");
      }

      setHours(Array.isArray(hData) ? (hData as WorkingHour[]) : []);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function loadBusy(d: string) {
    if (!appt?.barber_id || !d) return;

    setBusyLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("appointments")
      .select("start_time")
      .eq("date", d)
      .eq("barber_id", appt.barber_id)
      .neq("id", appt.id)
      .neq("status", "canceled")
      .order("start_time", { ascending: true });

    if (error) {
      setBusy([]);
      setBusyLoading(false);
      setMsgMode("warning");
      setMsg("Não consegui carregar horários ocupados.");
      return;
    }

    const reserved = ((data as BusyRow[]) || [])
      .map((x) => toHHMM(x.start_time))
      .filter(Boolean);
    setBusy(uniqSorted(reserved));
    setBusyLoading(false);
  }

  useEffect(() => {
    if (!date) {
      setBusy([]);
      setSelectedTime("");
      return;
    }
    setSelectedTime("");
    loadBusy(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const slots = useMemo(() => {
    if (!date || hours.length === 0) return [];

    const wd = new Date(date + "T00:00:00").getDay();
    const relevant = hours.filter((h) => Number(h.weekday) === wd);

    const all: string[] = [];
    const slotMinutes = 60; // padrão aqui (pode evoluir depois pelo service.duration)

    for (const h of relevant) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));
      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        all.push(minutesToHHMM(t));
      }
    }

    const unique = uniqSorted(all);
    return unique.filter((t) => !busy.includes(t));
  }, [date, hours, busy]);

  async function handleSave() {
    if (!appt) return;

    setMsg(null);

    if (!date) {
      setMsgMode("warning");
      setMsg("Selecione uma data.");
      return;
    }
    if (!selectedTime) {
      setMsgMode("warning");
      setMsg("Selecione um horário.");
      return;
    }

    setSaving(true);

    const slotMinutes = 60;
    const end_time = minutesToHHMM(hhmmToMinutes(selectedTime) + slotMinutes);

    // ✅ FIX: NÃO muda status para reschedule_requested (pois o CHECK não permite)
    // Mantém como "pending" para o cliente poder Confirmar/Recusar normalmente.
    const { error } = await supabase
      .from("appointments")
      .update({
        date,
        start_time: selectedTime,
        end_time,
        status: "pending",
      })
      .eq("id", appt.id)
      .eq("action_token", token);

    if (error) {
      setMsgMode("error");
      setMsg("Erro ao salvar: " + error.message);
      setSaving(false);
      return;
    }

    // ✅ Links pro cliente SEMPRE com token
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const clientToken = appt.action_token || "";

    const clientConfirmUrl = `${baseUrl}/confirm/${appt.id}?token=${clientToken}`;
    const clientDeclineUrl = `${baseUrl}/decline/${appt.id}?token=${clientToken}`;

    const message =
      `Novo horário sugerido\n\n` +
      `Cliente: ${appt.client_name || "—"}\n` +
      `Data: ${date}\n` +
      `Horário: ${selectedTime}\n\n` +
      `Confirmar: ${clientConfirmUrl}\n` +
      `Recusar: ${clientDeclineUrl}`;

    const wa = waLink(appt.client_phone || null);
    if (!wa) {
      setMsgMode("warning");
      setMsg("Sugestão salva, mas o WhatsApp do cliente não está cadastrado.");
      setSaving(false);
      return;
    }

    window.open(`${wa}?text=${encodeURIComponent(message)}`, "_blank");

    setMsgMode("success");
    setMsg("Sugestão salva e enviada ao cliente pelo WhatsApp.");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_25px_90px_rgba(0,0,0,0.65)] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-white/10">
          <p className="text-xs tracking-[0.22em] font-black text-white/60">
            BARBEIRO
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black">
            Sugerir novo horário
          </h1>
          <p className="mt-2 text-white/65 text-sm">
            Escolha uma data e um horário livre. O cliente recebe os links para
            confirmar ou recusar.
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
                    msgMode === "success" &&
                      "bg-emerald-500/10 border-emerald-400/30 text-emerald-200",
                    msgMode === "warning" &&
                      "bg-yellow-500/10 border-yellow-400/30 text-yellow-200",
                    msgMode === "error" &&
                      "bg-red-500/10 border-red-400/30 text-red-200",
                    msgMode === "info" &&
                      "bg-white/5 border-white/10 text-white/80",
                  )}
                >
                  <p className="font-bold">Aviso</p>
                  <p className="text-sm mt-1">{msg}</p>
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/55">Agendamento atual</p>
                <p className="mt-2 text-white/85">
                  <span className="text-white/55">Cliente:</span>{" "}
                  <span className="font-bold">{appt?.client_name || "—"}</span>
                </p>
                <p className="text-white/85">
                  <span className="text-white/55">Data:</span>{" "}
                  <span className="font-bold">{appt?.date || "—"}</span>
                </p>
                <p className="text-white/85">
                  <span className="text-white/55">Horário:</span>{" "}
                  <span className="font-bold">
                    {toHHMM(appt?.start_time)}
                    {appt?.end_time ? ` - ${toHHMM(appt?.end_time)}` : ""}
                  </span>
                </p>
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold text-white/80">
                  Nova data
                </label>
                <input
                  type="date"
                  className="w-full mt-2 bg-black/40 border border-white/10 rounded-2xl px-3 py-3 outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {busyLoading && (
                  <p className="mt-2 text-xs text-white/55">
                    Verificando horários ocupados...
                  </p>
                )}
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-white/80">
                  Horários livres
                </p>

                {!date ? (
                  <p className="mt-2 text-white/55">
                    Selecione uma data para ver os horários.
                  </p>
                ) : busyLoading ? (
                  <p className="mt-2 text-white/55">Carregando horários...</p>
                ) : slots.length === 0 ? (
                  <p className="mt-2 text-white/55">
                    Nenhum horário disponível nesse dia.
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((t) => {
                      const selected = selectedTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTime(t)}
                          className={clsx(
                            "h-11 rounded-2xl font-black border transition",
                            selected
                              ? "bg-yellow-400 text-black border-yellow-300"
                              : "bg-white/5 text-white/85 border-white/10 hover:bg-white/10",
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={!date || !selectedTime || saving}
                className={clsx(
                  "mt-6 w-full h-12 rounded-2xl font-black text-black transition",
                  "bg-yellow-400 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100",
                  "shadow-[0_0_0_1px_rgba(255,220,120,0.35),0_18px_55px_rgba(0,0,0,0.65)]",
                )}
              >
                {saving ? "Enviando..." : "Salvar e enviar ao cliente"}
              </button>

              <p className="mt-4 text-[11px] text-white/45 text-center">
                O cliente vai receber os links para confirmar ou recusar. (Links
                sempre com token.)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
