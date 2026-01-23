"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const daysOfWeek = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

type WorkingHour = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  barber_id: string | null;
  barbershop_id: string;
};

function toHHMM(t: string) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

export default function BarbeiroHorariosPage() {
  const supabase = createClient();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  const [hours, setHours] = useState<WorkingHour[]>([]);

  const [weekday, setWeekday] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBarber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBarber() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Precisamos do barbeiro vinculado ao user_id
    const { data: barber, error } = await supabase
      .from("barbers")
      .select("id, barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (error || !barber) {
      alert("Este usuário não está vinculado a um barbeiro.");
      return;
    }

    setBarberId(barber.id);
    setBarbershopId(barber.barbershop_id);
    await loadHours(barber.barbershop_id, barber.id);
  }

  async function loadHours(bsId: string, bId: string) {
    const { data, error } = await supabase
      .from("working_hours")
      .select("id, weekday, start_time, end_time, barber_id, barbershop_id")
      .eq("barbershop_id", bsId)
      .eq("barber_id", bId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      alert("Erro ao carregar horários: " + error.message);
      setHours([]);
      return;
    }

    setHours((data as WorkingHour[]) || []);
  }

  async function addHour() {
    if (!barberId || !barbershopId) return;

    setLoading(true);

    const { error } = await supabase.from("working_hours").insert({
      barbershop_id: barbershopId,
      barber_id: barberId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      alert("Erro ao salvar: " + error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    await loadHours(barbershopId, barberId);
  }

  async function removeHour(id: string) {
    if (!barberId || !barbershopId) return;
    if (!confirm("Deseja remover este horário?")) return;

    const { error } = await supabase.from("working_hours").delete().eq("id", id);

    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }

    await loadHours(barbershopId, barberId);
  }

  return (
    <div className="p-10 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-primary">Meus Horários de Trabalho</h1>

      <div className="bg-surface p-6 rounded space-y-4">
        <div className="flex flex-wrap gap-4">
          <select
            className="p-2 bg-black border border-white/10 rounded"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {daysOfWeek.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <input
            type="time"
            className="p-2 bg-black border border-white/10 rounded"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />

          <input
            type="time"
            className="p-2 bg-black border border-white/10 rounded"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />

          <button
            onClick={addHour}
            disabled={loading || !barberId || !barbershopId}
            className="bg-primary text-black px-4 py-2 rounded font-bold"
          >
            {loading ? "Salvando..." : "Adicionar"}
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Esses horários alimentam diretamente o agendamento público.
        </p>
      </div>

      <div className="space-y-3">
        {hours.length === 0 ? (
          <div className="text-zinc-400">Nenhum horário cadastrado ainda.</div>
        ) : (
          hours.map((h) => (
            <div
              key={h.id}
              className="bg-surface p-4 rounded flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-primary">
                  {daysOfWeek.find((d) => d.value === Number(h.weekday))?.label}
                </p>
                <p>
                  {toHHMM(h.start_time)} - {toHHMM(h.end_time)}
                </p>
              </div>

              <button onClick={() => removeHour(h.id)} className="text-red-500">
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
