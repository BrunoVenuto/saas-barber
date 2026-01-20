"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Appointment = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  profiles: { name: string | null } | null;
  services: { name: string | null } | null;
};

type AppointmentDbRow = {
  id: unknown;
  date: unknown;
  start_time: unknown;
  end_time: unknown;
  status: unknown;
  profiles?: { name?: unknown } | null;
  services?: { name?: unknown } | null;
};

export default function BarbeiroHistoricoPage() {
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
      setLoading(false);
      return;
    }

    // 2️⃣ Descobrir barbeiro
    const { data: barber } = await supabase
      .from("barbers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!barber) {
      alert("Este usuário não é um barbeiro.");
      setLoading(false);
      return;
    }

    // 3️⃣ Buscar TODOS os agendamentos desse barbeiro (passados)
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        date,
        start_time,
        end_time,
        status,
        profiles(name),
        services(name)
      `
      )
      .eq("barber_id", barber.id)
      .in("status", ["done", "cancelled"])
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
      profiles: a.profiles ? { name: (a.profiles.name as string | null) ?? null } : null,
      services: a.services ? { name: (a.services.name as string | null) ?? null } : null,
    }));

    setAppointments(mapped);
    setLoading(false);
  }

  function statusLabel(status: string) {
    if (status === "done") return "Concluído";
    if (status === "cancelled") return "Cancelado";
    return status;
  }

  if (loading) return <div className="p-10">Carregando...</div>;

  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold text-primary">
        Histórico de Atendimentos
      </h1>

      {appointments.length === 0 && (
        <p className="opacity-70">Nenhum atendimento no histórico.</p>
      )}

      <div className="space-y-4">
        {appointments.map((a) => (
          <div key={a.id} className="bg-surface p-4 rounded">
            <p className="font-bold text-primary">
              {a.date} — {a.start_time} às {a.end_time}
            </p>
            <p>Cliente: {a.profiles?.name ?? "-"}</p>
            <p>Serviço: {a.services?.name ?? "-"}</p>
            <p>
              Status:{" "}
              <span className={a.status === "done" ? "text-green-500" : "text-red-500"}>
                {statusLabel(a.status)}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
