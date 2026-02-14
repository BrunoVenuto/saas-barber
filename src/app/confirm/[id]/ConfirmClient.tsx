"use client";

import { useMemo, useState } from "react";
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
  barber_whatsapp?: string | null; // ✅ barbers.whatsapp
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function toWhatsAppDigits(raw: string | null | undefined) {
  const d = onlyDigits(raw || "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  // BR: 10/11 dígitos -> adiciona 55
  if (d.length === 10 || d.length === 11) return `55${d}`;
  // se vier internacional, mantém como está
  return d;
}

function hhmm(t: string) {
  return (t || "").slice(0, 5);
}

function waLink(raw: string | null | undefined) {
  const digits = toWhatsAppDigits(raw);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default function ConfirmClient({ appointment }: { appointment: Appointment }) {
  const supabase = createClient();

  // Mantive seu estado original
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyClientLink, setNotifyClientLink] = useState<string | null>(null);

  // ✅ Link para o CLIENTE avisar o BARBEIRO selecionado no agendamento
  const notifyBarberLink = useMemo(() => {
    const base = waLink(appointment.barber_whatsapp);
    if (!base) return null;

    const message = `Olá! 👋
Acabei de fazer um agendamento pelo site.

👤 Cliente: ${appointment.client_name}
📞 WhatsApp do cliente: ${appointment.client_phone || "—"}
✂️ Serviço: ${appointment.service_name || "—"}
💈 Barbeiro: ${appointment.barber_name || "—"}
📅 Data: ${appointment.date}
🕒 Horário: ${hhmm(appointment.start_time)} - ${hhmm(appointment.end_time)}

Pode confirmar pra mim, por favor? ✅`;

    return base + "?text=" + encodeURIComponent(message);
  }, [appointment]);

  /**
   * ⚠️ OBS: Essa tela é do CLIENTE.
   * Eu recomendo que a confirmação no banco seja feita pelo painel do BARBEIRO.
   * Mas mantive sua função (caso você queira usar internamente).
   */
  async function handleConfirm() {
    setConfirming(true);
    setMsg(null);

    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointment.id);

    if (error) {
      setMsg("Erro ao confirmar: " + error.message);
    } else {
      setMsg("✅ Agendamento confirmado!");

      // Notificar cliente via WhatsApp (mantido)
      if (appointment.client_phone) {
        const message = `Seu agendamento foi confirmado!
Serviço: ${appointment.service_name || "—"}
Barbeiro: ${appointment.barber_name || "—"}
Data: ${appointment.date}
Horário: ${hhmm(appointment.start_time)} - ${hhmm(appointment.end_time)}`;

        const link = waLink(appointment.client_phone) + "?text=" + encodeURIComponent(message);
        setNotifyClientLink(link);
      }
    }

    setConfirming(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Agendamento realizado ✅</h1>

        <div className="space-y-2 text-sm">
          <p><strong>Cliente:</strong> {appointment.client_name}</p>
          <p><strong>Telefone:</strong> {appointment.client_phone}</p>
          <p><strong>Serviço:</strong> {appointment.service_name || "—"}</p>
          <p><strong>Barbeiro:</strong> {appointment.barber_name || "—"}</p>
          <p><strong>Whats do barbeiro:</strong> {appointment.barber_whatsapp || "—"}</p>
          <p><strong>Data:</strong> {appointment.date}</p>
          <p><strong>Horário:</strong> {hhmm(appointment.start_time)} - {hhmm(appointment.end_time)}</p>
          <p><strong>Status:</strong> {appointment.status}</p>
        </div>

        {/* ✅ BOTÃO PRINCIPAL: cliente avisa o barbeiro */}
        <div className="mt-6">
          <a
            href={notifyBarberLink || "#"}
            onClick={(e) => {
              if (!notifyBarberLink) {
                e.preventDefault();
                alert("Este barbeiro ainda não tem WhatsApp cadastrado no sistema.");
              }
            }}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center w-full bg-emerald-500 text-black font-bold py-3 rounded-xl hover:brightness-110"
          >
            📲 Avisar o barbeiro no WhatsApp
          </a>
        </div>

        {msg && (
          <div className="mt-4 p-3 rounded bg-green-900/20 border border-green-500/20 text-green-300">
            {msg}
          </div>
        )}

        {/* (Opcional) Mantive seu botão antigo */}
        {appointment.status !== "confirmed" && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="mt-4 w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50"
          >
            {confirming ? "Confirmando..." : "Confirmar Agendamento (opcional)"}
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
