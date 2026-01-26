"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

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

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function waLink(raw: string | null) {
  const d = onlyDigits(raw || "");
  if (!d) return null;
  const final = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${final}`;
}

export default function ConfirmClient({ appointment }: { appointment: Appointment }) {
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyClientLink, setNotifyClientLink] = useState<string | null>(null);

  async function handleConfirm() {
    setConfirming(true);
    setMsg(null);

    const { error } = await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appointment.id);

    if (error) {
      setMsg("Erro ao confirmar: " + error.message);
    } else {
      setMsg("✅ Agendamento confirmado!");
      // Notificar cliente via WhatsApp
      if (appointment.client_phone) {
        const message = `Seu agendamento foi confirmado!\nServiço: ${appointment.service_name || '—'}\nBarbeiro: ${appointment.barber_name || '—'}\nData: ${appointment.date}\nHorário: ${appointment.start_time} - ${appointment.end_time}`;
        const link = waLink(appointment.client_phone) + '?text=' + encodeURIComponent(message);
        setNotifyClientLink(link);
      }
    }

    setConfirming(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Confirmar Agendamento</h1>

        <div className="space-y-2 text-sm">
          <p><strong>Cliente:</strong> {appointment.client_name}</p>
          <p><strong>Telefone:</strong> {appointment.client_phone}</p>
          <p><strong>Serviço:</strong> {appointment.service_name || "—"}</p>
          <p><strong>Barbeiro:</strong> {appointment.barber_name || "—"}</p>
          <p><strong>Data:</strong> {appointment.date}</p>
          <p><strong>Horário:</strong> {appointment.start_time} - {appointment.end_time}</p>
          <p><strong>Status:</strong> {appointment.status}</p>
        </div>

        {msg && (
          <div className="mt-4 p-3 rounded bg-green-900/20 border border-green-500/20 text-green-300">
            {msg}
          </div>
        )}

        {appointment.status !== "confirmed" && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="mt-6 w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50"
          >
            {confirming ? "Confirmando..." : "Confirmar Agendamento"}
          </button>
        )}

        {notifyClientLink && (
          <div className="mt-4">
            <a
              href={notifyClientLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full bg-emerald-500 text-black font-bold py-3 rounded-xl hover:brightness-110"
            >
              Notificar cliente via WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}