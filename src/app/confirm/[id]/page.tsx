import { createClient } from "@/lib/supabase/server";
import ConfirmClient from "./ConfirmClient";

type Appointment = {
  id: string;
  client_name: string;
  client_phone: string;
  service_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  barber_name?: string;
};

async function getAppointment(id: string): Promise<Appointment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      client_name,
      client_phone,
      date,
      start_time,
      end_time,
      status,
      services (name),
      barbers (name)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    client_name: data.client_name,
    client_phone: data.client_phone,
    service_name: (data.services as { name: string }[] | null)?.[0]?.name,
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status,
    barber_name: (data.barbers as { name: string }[] | null)?.[0]?.name,
  };
}

export default async function ConfirmAppointmentPage({ params }: { params: { id: string } }) {
  const appointment = await getAppointment(params.id);

  if (!appointment) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md text-center">
          <h1 className="text-xl font-bold">Agendamento não encontrado</h1>
          <p className="text-zinc-400 mt-2">Verifique o link.</p>
        </div>
      </div>
    );
  }

  return <ConfirmClient appointment={appointment} />;
}