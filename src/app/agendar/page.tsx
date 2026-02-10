"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Barber = { id: string; name: string };
type Service = { id: string; name: string; duration_minutes: number };
type WorkingHour = { weekday: number; start_time: string; end_time: string };
type Appointment = { start_time: string; end_time: string };
type Barbershop = {
  id: string;
  name?: string;
  slug: string;
  is_active?: boolean;
};

export default function PublicBookingPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams();
  const slug = params.slug as string;

  const [, setBarbershop] = useState<Barbershop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD BARBERSHOP
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: shop, error: shopErr } = await supabase
        .from("barbershops")
        .select("*")
        .eq("slug", slug)
        .single();

      if (shopErr || !shop || cancelled) return;

      setBarbershop(shop as Barbershop);

      const shopId = (shop as Barbershop).id;

      const [{ data: b }, { data: s }] = await Promise.all([
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

      setBarbers(Array.isArray(b) ? (b as Barber[]) : []);
      setServices(Array.isArray(s) ? (s as Service[]) : []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, supabase]);

  // =========================
  // LOAD DAY DATA
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function loadDay() {
      if (!selectedBarber || !date) return;

      setTime("");

      const d = new Date(date);
      const weekday = d.getDay() === 0 ? 7 : d.getDay(); // 1-7

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

      if (cancelled) return;

      setWorkingHours(Array.isArray(wh) ? (wh as WorkingHour[]) : []);
      setAppointments(Array.isArray(ap) ? (ap as Appointment[]) : []);
    }

    loadDay();
    return () => {
      cancelled = true;
    };
  }, [selectedBarber, date, supabase]);

  // HELPERS
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

  // BUILD SLOTS
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

  // SUBMIT
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
  }

  // UI
  return (
    <div className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-4xl font-black text-yellow-400">
        Agende seu horário
      </h1>

      <div className="grid md:grid-cols-2 gap-4">
        <select
          className="p-3 rounded bg-zinc-900 border border-white/10"
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

        <select
          className="p-3 rounded bg-zinc-900 border border-white/10"
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

      <input
        type="date"
        className="p-3 rounded bg-zinc-900 border border-white/10"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {slots.length === 0 && (
          <p className="opacity-60">Nenhum horário disponível.</p>
        )}

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

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="w-full bg-yellow-400 text-black font-black py-4 rounded text-lg"
      >
        {loading ? "Agendando..." : "Confirmar Agendamento"}
      </button>
    </div>
  );
}
