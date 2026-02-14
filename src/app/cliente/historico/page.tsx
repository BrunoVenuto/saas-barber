"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Appointment = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  barbers: { name: string | null } | null;
  services: { name: string | null } | null;
};

type AppointmentDbRow = {
  id: unknown;
  date: unknown;
  start_time: unknown;
  end_time: unknown;
  status: unknown;
  barbers?: { name?: unknown } | null;
  services?: { name?: unknown } | null;
};

export default function ClienteHistoricoPage() {
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    setLoading(true);

    // 1️⃣ Usuário logado
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    // 2️⃣ Buscar TODOS os agendamentos desse cliente
    const { data, error } = await supabase
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
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      console.error("Erro ao buscar histórico:", error);
      setAppointments([]);
      setLoading(false);
      return;
    }

    if (!Array.isArray(data)) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const mapped: Appointment[] = (data as AppointmentDbRow[]).map((a) => ({
      id: String(a.id),
      date: String(a.date),
      start_time: String(a.start_time),
      end_time: String(a.end_time),
      status: String(a.status),
      barbers: a.barbers ? { name: (a.barbers.name as string | null) ?? null } : null,
      services: a.services ? { name: (a.services.name as string | null) ?? null } : null,
    }));

    setAppointments(mapped);
    setLoading(false);
  }

  function statusLabel(status: string) {
    if (status === "done") return "Concluído";
    if (status === "cancelled") return "Cancelado";
    if (status === "scheduled") return "Agendado";
    return status;
  }

  function statusColor(status: string) {
    if (status === "done") return "text-green-500";
    if (status === "cancelled") return "text-red-500";
    if (status === "scheduled") return "text-yellow-400";
    return "";
  }

  if (loading) return <div className="p-10">Carregando...</div>;

  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold text-primary">Meus Agendamentos</h1>

      {appointments.length === 0 && (
        <p className="opacity-70">Você ainda não tem agendamentos.</p>
      )}

      <div className="space-y-4">
        {appointments.map((a) => (
          <div key={a.id} className="bg-surface p-4 rounded">
            <p className="font-bold text-primary">
              {a.date} — {a.start_time} às {a.end_time}
            </p>
            <p>Barbeiro: {a.barbers?.name ?? "-"}</p>
            <p>Serviço: {a.services?.name ?? "-"}</p>
            <p>
              Status:{" "}
              <span className={statusColor(a.status)}>
                {statusLabel(a.status)}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
