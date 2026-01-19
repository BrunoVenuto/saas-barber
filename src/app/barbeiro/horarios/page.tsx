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

type Availability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export default function BarbeiroHorariosPage() {
  const supabase = createClient();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBarber();
  }, []);

  async function loadBarber() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: barber } = await supabase
      .from("barbers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!barber) {
      alert("Este usuário não está vinculado a um barbeiro.");
      return;
    }

    setBarberId(barber.id);
    loadAvailability(barber.id);
  }

  async function loadAvailability(bid: string) {
    const { data } = await supabase
      .from("barber_availability")
      .select("*")
      .eq("barber_id", bid)
      .order("day_of_week");

    if (data) setAvailability(data);
  }

  async function addAvailability() {
    if (!barberId) return;

    setLoading(true);

    const { error } = await supabase.from("barber_availability").insert({
      barber_id: barberId,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      alert("Erro ao salvar: " + error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    loadAvailability(barberId);
  }

  async function removeAvailability(id: string) {
    if (!confirm("Deseja remover este horário?")) return;

    await supabase.from("barber_availability").delete().eq("id", id);

    if (barberId) loadAvailability(barberId);
  }

  return (
    <div className="p-10 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-primary">
        Meus Horários de Trabalho
      </h1>

      <div className="bg-surface p-6 rounded space-y-4">
        <div className="flex gap-4">
          <select
            className="p-2 bg-black border border-white/10 rounded"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
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
            onClick={addAvailability}
            disabled={loading}
            className="bg-primary text-black px-4 rounded font-bold"
          >
            {loading ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {availability.map((a) => (
          <div
            key={a.id}
            className="bg-surface p-4 rounded flex justify-between"
          >
            <div>
              <p className="font-bold text-primary">
                {
                  daysOfWeek.find((d) => d.value === a.day_of_week)?.label
                }
              </p>
              <p>
                {a.start_time} - {a.end_time}
              </p>
            </div>

            <button
              onClick={() => removeAvailability(a.id)}
              className="text-red-500"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
