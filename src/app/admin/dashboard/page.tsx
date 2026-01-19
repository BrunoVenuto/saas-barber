"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Appointment = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  barber_id: string;
  service: {
    name: string;
    price: number | null;
  } | null;
  client: {
    name: string;
    phone: string;
  } | null;
};

export default function DashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [appointmentsToday, setAppointmentsToday] = useState<Appointment[]>([]);
  const [appointmentsMonth, setAppointmentsMonth] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1️⃣ Usuário logado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 2️⃣ Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!prof) return;

      setProfile(prof);

      // 3️⃣ Busca agendamentos de hoje
      let queryToday = supabase
        .from("appointments")
        .select(
          `
          id,
          date,
          start_time,
          end_time,
          status,
          barber_id,
          service:services ( name, price ),
          client:clients ( name, phone )
        `
        )
        .eq("date", today)
        .eq("barbershop_id", prof.barbershop_id)
        .order("start_time");

      // Se for barbeiro, filtra só os dele
      if (prof.role === "barber") {
        queryToday = queryToday.eq("barber_id", prof.id);
      }

      const { data: todayData } = await queryToday;

      setAppointmentsToday(todayData || []);

      // 4️⃣ Busca agendamentos do mês
      let queryMonth = supabase
        .from("appointments")
        .select(
          `
          id,
          date,
          start_time,
          end_time,
          status,
          barber_id,
          service:services ( name, price ),
          client:clients ( name, phone )
        `
        )
        .gte("date", firstDayOfMonth)
        .eq("barbershop_id", prof.barbershop_id);

      if (prof.role === "barber") {
        queryMonth = queryMonth.eq("barber_id", prof.id);
      }

      const { data: monthData } = await queryMonth;

      setAppointmentsMonth(monthData || []);

      setLoading(false);
    }

    load();
  }, []);

  const totalToday = appointmentsToday.reduce(
    (sum, a) => sum + (a.service?.price || 0),
    0
  );

  const totalMonth = appointmentsMonth.reduce(
    (sum, a) => sum + (a.service?.price || 0),
    0
  );

  if (loading) {
    return <div className="p-10 text-white">Carregando dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-black text-yellow-400">📊 Dashboard</h1>
        <p className="text-zinc-400">
          Bem-vindo, {profile?.name} ({profile?.role})
        </p>
      </div>

      {/* CARDS */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-lg border border-white/10">
          <p className="text-zinc-400">Faturamento hoje</p>
          <p className="text-3xl font-black text-yellow-400">
            R$ {totalToday.toFixed(2)}
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-lg border border-white/10">
          <p className="text-zinc-400">Faturamento do mês</p>
          <p className="text-3xl font-black text-yellow-400">
            R$ {totalMonth.toFixed(2)}
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-lg border border-white/10">
          <p className="text-zinc-400">Atendimentos hoje</p>
          <p className="text-3xl font-black text-yellow-400">
            {appointmentsToday.length}
          </p>
        </div>
      </div>

      {/* LISTA DE HOJE */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-yellow-400">
          ⏱️ Agenda de Hoje
        </h2>

        {appointmentsToday.length === 0 && (
          <p className="text-zinc-500">Nenhum atendimento hoje.</p>
        )}

        {appointmentsToday.map((a) => (
          <div
            key={a.id}
            className="bg-zinc-900 p-4 rounded flex justify-between items-center border border-white/10"
          >
            <div>
              <p className="font-bold text-yellow-400">
                {a.start_time.slice(0, 5)} - {a.service?.name}
              </p>
              <p className="text-zinc-400 text-sm">
                Cliente: {a.client?.name} • {a.client?.phone}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold">
                R$ {(a.service?.price || 0).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
