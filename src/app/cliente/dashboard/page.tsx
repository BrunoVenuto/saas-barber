"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageTitle } from "@/components/ui/PageTitle";

type Appointment = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  barbers: { name: string };
  services: { name: string };
};

export default function ClienteDashboard() {
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcoming();
  }, []);

  async function loadUpcoming() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("appointments")
      .select(
        `
        id,
        date,
        start_time,
        end_time,
        status,
        barbers(name),
        services(name)
      `
      )
      .eq("client_id", user.id)
      .eq("status", "scheduled")
      .gte("date", today)
      .order("date")
      .order("start_time");

    if (data) setAppointments(data as any);

    setLoading(false);
  }

  return (
    <div className="p-10 space-y-8">
      <PageTitle
        title="👋 Bem-vindo"
        subtitle="Aqui estão seus próximos agendamentos"
      />

      {loading && <p className="opacity-60">Carregando...</p>}

      {!loading && appointments.length === 0 && (
        <Card>
          <p className="opacity-70">Você não tem nenhum agendamento futuro.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {appointments.map((a) => (
          <Card
            key={a.id}
            className="border-orange-500/20 shadow-orange-500/10"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xl font-bold text-orange-400">
                  {a.date} — {a.start_time}
                </p>
                <p className="text-white/70">
                  Barbeiro: {a.barbers?.name}
                </p>
                <p className="text-white/70">
                  Serviço: {a.services?.name}
                </p>
              </div>

              <Badge variant="warning">Agendado</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
