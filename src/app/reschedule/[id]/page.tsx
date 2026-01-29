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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

      if (!id || !tokenOk) {
        setMsg("Link inválido.");
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
        setMsg("Link inválido ou já usado.");
        setLoading(false);
        return;
      }

      setAppt(data as Appointment);

      const { data: hData } = await supabase
        .from("working_hours")
        .select("id,barber_id,weekday,start_time,end_time")
        .eq("barber_id", data.barber_id);

      setHours(Array.isArray(hData) ? hData : []);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function loadBusy(d: string) {
    if (!appt?.barber_id || !d) return;

    const { data } = await supabase
      .from("appointments")
      .select("start_time,status")
      .eq("date", d)
      .eq("barber_id", appt.barber_id)
      .neq("id", appt.id)
      .neq("status", "canceled");

    const reserved = (data || []).map((x: { start_time: string }) =>
      toHHMM(x.start_time),
    );
    setBusy(uniqSorted(reserved));
  }

  useEffect(() => {
    if (date) loadBusy(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const slots = useMemo(() => {
    if (!date || !hours.length) return [];

    const wd = new Date(date + "T00:00:00").getDay();
    const relevant = hours.filter((h) => Number(h.weekday) === wd);

    const all: string[] = [];
    for (const h of relevant) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));
      for (let t = start; t + 60 <= end; t += 60) {
        all.push(minutesToHHMM(t));
      }
    }

    const unique = uniqSorted(all);
    return unique.filter((t) => !busy.includes(t));
  }, [date, hours, busy]);

  async function handleSave() {
    if (!appt || !date || !selectedTime) return;

    setSaving(true);
    setMsg(null);

    const end_time = minutesToHHMM(hhmmToMinutes(selectedTime) + 60);

    const { error } = await supabase
      .from("appointments")
      .update({
        date,
        start_time: selectedTime,
        end_time,
        status: "reschedule_requested",
      })
      .eq("id", appt.id)
      .eq("action_token", token);

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      setSaving(false);
      return;
    }

    // ✅ AQUI ESTÁ O PONTO CRÍTICO: LINKS COM TOKEN
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const clientConfirmUrl = `${baseUrl}/confirm/${appt.id}?token=${appt.action_token}`;
    const clientDeclineUrl = `${baseUrl}/decline/${appt.id}?token=${appt.action_token}`;

    const message =
      `Olá ${appt.client_name || ""}, o barbeiro sugeriu um novo horário:\n\n` +
      `Data: ${date}\n` +
      `Horário: ${selectedTime}\n\n` +
      `Você pode:\n` +
      `Confirmar: ${clientConfirmUrl}\n` +
      `Recusar: ${clientDeclineUrl}`;

    const wa = waLink(appt.client_phone || null);
    if (wa) {
      window.open(`${wa}?text=${encodeURIComponent(message)}`, "_blank");
    }

    setMsg("Sugestão enviada ao cliente pelo WhatsApp.");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/40 backdrop-blur-md p-6">
        <h1 className="text-2xl font-black">Sugerir novo horário</h1>

        {loading ? (
          <p className="mt-4 text-white/70">Carregando...</p>
        ) : (
          <>
            {msg && (
              <div className="mt-4 p-3 rounded-xl bg-white/10">{msg}</div>
            )}

            <div className="mt-4">
              <label className="text-sm font-bold">Nova data</label>
              <input
                type="date"
                className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <p className="text-sm font-bold">Horários disponíveis</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={clsx(
                      "h-10 rounded-xl font-bold",
                      selectedTime === t
                        ? "bg-yellow-400 text-black"
                        : "bg-white/10",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!date || !selectedTime || saving}
              onClick={handleSave}
              className="mt-6 w-full h-12 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
            >
              {saving ? "Enviando..." : "Enviar sugestão ao cliente"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
