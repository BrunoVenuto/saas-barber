"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Barber = {
  id: string;
  name: string;
};

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
};

type WorkingHour = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type Appointment = {
  start_time: string;
  end_time: string;
};

type Barbershop = {
  id: string;
  name?: string;
  slug: string;
  is_active?: boolean;
};

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Erro inesperado.";
  }
}

export default function PublicBookingPage() {
  const supabase = useMemo(() => createClient(), []);

  // suporta os dois cenários: /agendar e /agendar/[slug]
  const params = useParams() as { slug?: string };
  const pathname = usePathname();
  const search = useSearchParams();

  const slugFromParams = params?.slug;
  const slugFromPath = pathname?.split("/").filter(Boolean).pop();
  const slug = (slugFromParams || slugFromPath || "").trim();

  const debug = search.get("debug") === "1";

  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // =========================
  // HELPERS
  // =========================
  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(m: number) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const min = (m % 60).toString().padStart(2, "0");
    return `${h}:${min}`;
  }

  // =========================
  // LOAD BARBERSHOP + BARBERS + SERVICES
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setPageLoading(true);
        setErrorMsg(null);

        // Se alguém abrir /agendar (sem slug), mostra instrução simples
        if (!slug || slug === "agendar") {
          setBarbershop(null);
          setBarbers([]);
          setServices([]);
          return;
        }

        const { data: shop, error: shopErr } = await supabase
          .from("barbershops")
          .select("*")
          .eq("slug", slug)
          .single();

        if (cancelled) return;

        if (shopErr || !shop) {
          setErrorMsg("Não encontrei a barbearia (slug inválido ou inativa).");
          setBarbershop(null);
          setBarbers([]);
          setServices([]);
          return;
        }

        const shopTyped = shop as Barbershop;
        setBarbershop(shopTyped);

        const shopId = shopTyped.id;

        const [{ data: b, error: bErr }, { data: s, error: sErr }] =
          await Promise.all([
            supabase
              .from("barbers")
              .select("id, name")
              .eq("barbershop_id", shopId)
              .order("name"),
            supabase
              .from("services")
              .select("id, name, duration_minutes")
              .eq("barbershop_id", shopId)
              .order("name"),
          ]);

        if (cancelled) return;

        if (bErr && debug) console.log("barbers error:", bErr);
        if (sErr && debug) console.log("services error:", sErr);

        setBarbers(Array.isArray(b) ? (b as Barber[]) : []);
        setServices(Array.isArray(s) ? (s as Service[]) : []);

        // reseta seleções quando trocar de slug/barbearia
        setSelectedBarber("");
        setSelectedService("");
        setDate("");
        setTime("");
        setWorkingHours([]);
        setAppointments([]);
      } catch (e: unknown) {
        if (!cancelled) setErrorMsg(getErrorMessage(e));
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug, supabase, debug]);

  // =========================
  // LOAD DAY DATA (working_hours + appointments)
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function loadDay() {
      if (!selectedBarber || !date) return;

      setTime("");
      setWorkingHours([]);
      setAppointments([]);

      const d = new Date(date);
      const weekday = d.getDay() === 0 ? 7 : d.getDay(); // 1-7

      const [{ data: wh, error: whErr }, { data: ap, error: apErr }] =
        await Promise.all([
          supabase
            .from("working_hours")
            .select("weekday, start_time, end_time")
            .eq("barber_id", selectedBarber)
            .eq("weekday", weekday),
          supabase
            .from("appointments")
            .select("start_time, end_time")
            .eq("barber_id", selectedBarber)
            .eq("date", date)
            .eq("status", "scheduled"),
        ]);

      if (cancelled) return;

      if (whErr && debug) console.log("working_hours error:", whErr);
      if (apErr && debug) console.log("appointments error:", apErr);

      setWorkingHours(Array.isArray(wh) ? (wh as WorkingHour[]) : []);
      setAppointments(Array.isArray(ap) ? (ap as Appointment[]) : []);
    }

    loadDay();

    return () => {
      cancelled = true;
    };
  }, [selectedBarber, date, supabase, debug]);

  // =========================
  // BUILD SLOTS
  // =========================
  const slots: string[] = useMemo(() => {
    if (!selectedService) return [];
    if (workingHours.length === 0) return [];

    const service = services.find((s) => s.id === selectedService);
    if (!service) return [];

    const duration = service.duration_minutes;

    const occupied =
      appointments.map((a) => ({
        start: timeToMinutes(a.start_time),
        end: timeToMinutes(a.end_time),
      })) || [];

    const result: string[] = [];

    for (const wh of workingHours) {
      let start = timeToMinutes(wh.start_time);
      const end = timeToMinutes(wh.end_time);

      while (start + duration <= end) {
        const slotStart = start;
        const slotEnd = start + duration;

        const conflict = occupied.some(
          (o) => !(slotEnd <= o.start || slotStart >= o.end),
        );
        if (!conflict) result.push(minutesToTime(slotStart));

        start += 30;
      }
    }

    return result;
  }, [workingHours, appointments, selectedService, services]);

  // =========================
  // SUBMIT
  // =========================
  async function handleSubmit() {
    if (!selectedBarber || !selectedService || !date || !time) {
      alert("Preencha tudo.");
      return;
    }

    setLoading(true);

    const service = services.find((s) => s.id === selectedService);
    if (!service) {
      setLoading(false);
      return;
    }

    const startMin = timeToMinutes(time);
    const endMin = startMin + service.duration_minutes;

    const { error } = await supabase.from("appointments").insert({
      barber_id: selectedBarber,
      service_id: selectedService,
      client_id: null,
      date,
      start_time: time,
      end_time: minutesToTime(endMin),
      status: "scheduled",
    });

    if (error) {
      alert("Erro ao criar agendamento: " + error.message);
      setLoading(false);
      return;
    }

    alert("✅ Agendado com sucesso!");
    setLoading(false);

    // recarrega o dia para refletir o horário ocupado
    const d = new Date(date);
    const weekday = d.getDay() === 0 ? 7 : d.getDay();

    const [{ data: wh }, { data: ap }] = await Promise.all([
      supabase
        .from("working_hours")
        .select("weekday, start_time, end_time")
        .eq("barber_id", selectedBarber)
        .eq("weekday", weekday),
      supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("barber_id", selectedBarber)
        .eq("date", date)
        .eq("status", "scheduled"),
    ]);

    setWorkingHours(Array.isArray(wh) ? (wh as WorkingHour[]) : []);
    setAppointments(Array.isArray(ap) ? (ap as Appointment[]) : []);
    setTime("");
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-yellow-400">
          {barbershop?.name
            ? `Agende em ${barbershop.name}`
            : "Agende seu horário"}
        </h1>

        {debug && (
          <p className="text-xs opacity-70">
            Debug: slug={slug} | barbers={barbers.length} | services=
            {services.length}
          </p>
        )}

        {errorMsg && (
          <div className="p-3 rounded bg-red-500/15 border border-red-500/30 text-red-200">
            {errorMsg}
          </div>
        )}

        {!errorMsg && (!slug || slug === "agendar") && (
          <div className="p-3 rounded bg-white/5 border border-white/10 text-white/80">
            Abra um link no formato{" "}
            <span className="text-yellow-300 font-semibold">
              /agendar/SEU-SLUG
            </span>
            .
          </div>
        )}
      </div>

      {pageLoading ? (
        <div className="p-4 rounded bg-white/5 border border-white/10">
          Carregando...
        </div>
      ) : (
        <>
          {/* BARBER */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Barbeiro</div>

            {/* Desktop select */}
            <div className="hidden md:block">
              <select
                className="w-full p-3 rounded bg-zinc-900 border border-white/10 text-white"
                style={{ colorScheme: "dark" }}
                value={selectedBarber}
                onChange={(e) => setSelectedBarber(e.target.value)}
              >
                <option value="">Selecione o barbeiro</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile buttons */}
            <div className="md:hidden grid grid-cols-1 gap-2">
              {barbers.length === 0 ? (
                <p className="opacity-60">Nenhum barbeiro disponível.</p>
              ) : (
                barbers.map((b) => {
                  const active = selectedBarber === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarber(b.id)}
                      className={`p-3 rounded border text-left font-semibold transition
                        ${
                          active
                            ? "bg-yellow-400 text-black border-yellow-400"
                            : "bg-zinc-900 text-white border-white/10 hover:bg-zinc-800"
                        }`}
                    >
                      {b.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* SERVICE */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Serviço</div>

            {/* Desktop select */}
            <div className="hidden md:block">
              <select
                className="w-full p-3 rounded bg-zinc-900 border border-white/10 text-white"
                style={{ colorScheme: "dark" }}
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
              >
                <option value="">Selecione o serviço</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile buttons */}
            <div className="md:hidden grid grid-cols-1 gap-2">
              {services.length === 0 ? (
                <p className="opacity-60">Nenhum serviço disponível.</p>
              ) : (
                services.map((s) => {
                  const active = selectedService === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s.id)}
                      className={`p-3 rounded border text-left font-semibold transition
                        ${
                          active
                            ? "bg-yellow-400 text-black border-yellow-400"
                            : "bg-zinc-900 text-white border-white/10 hover:bg-zinc-800"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{s.name}</span>
                        <span
                          className={active ? "text-black/80" : "text-white/70"}
                        >
                          {s.duration_minutes} min
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* DATE */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Data</div>
            <input
              type="date"
              className="w-full p-3 rounded bg-zinc-900 border border-white/10 text-white"
              style={{ colorScheme: "dark" }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* SLOTS */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Horários</div>

            {!selectedBarber ? (
              <p className="opacity-60">Selecione um barbeiro.</p>
            ) : !selectedService ? (
              <p className="opacity-60">Selecione um serviço.</p>
            ) : !date ? (
              <p className="opacity-60">Selecione uma data.</p>
            ) : slots.length === 0 ? (
              <p className="opacity-60">Nenhum horário disponível.</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {slots.map((t) => {
                  const isSelected = t === time;

                  return (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className={`py-2 rounded font-bold transition ${
                        isSelected
                          ? "bg-yellow-400 text-black"
                          : "bg-green-600 hover:bg-green-500 text-white"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SUBMIT */}
          <button
            disabled={
              loading || !selectedBarber || !selectedService || !date || !time
            }
            onClick={handleSubmit}
            className="w-full bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded text-lg"
          >
            {loading ? "Agendando..." : "Confirmar Agendamento"}
          </button>
        </>
      )}
    </div>
  );
}
