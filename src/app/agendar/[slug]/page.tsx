"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Barbershop = {
  id: string;
  name: string;
  slug: string;
};

type Barber = {
  id: string;
  name: string;
  barbershop_id: string | null;
  active?: boolean | null;
};

type Service = {
  id: string;
  name: string;
  barbershop_id: string | null;
  price?: number | null;
  duration_minutes?: number | null;
};

type WorkingHour = {
  id: string;
  barbershop_id: string | null;
  barber_id: string | null;
  weekday: number | string;
  start_time: string; // "09:00:00" ou "09:00"
  end_time: string; // "17:00:00" ou "17:00"
};

type AppointmentBusy = {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toWeekday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay();
}

function toHHMM(t: string) {
  if (!t) return "";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort(
    (a, b) => hhmmToMinutes(a) - hhmmToMinutes(b)
  );
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

// BR: aceita 10/11 (DDD + número). Também aceita 12/13 (se usuário digitar com 55).
function isValidWhatsappDigits(phoneDigits: string) {
  const n = phoneDigits.length;
  return n === 10 || n === 11 || n === 12 || n === 13;
}

// Detecta erro do unique index (race condition)
function isUniqueViolation(err: any) {
  const code = err?.code;
  const msg = String(err?.message || "").toLowerCase();
  // Postgres unique_violation = 23505 (geralmente vem nesse campo no supabase)
  if (code === "23505") return true;
  // fallback por mensagem
  if (msg.includes("duplicate key value") || msg.includes("unique constraint")) return true;
  return false;
}

export default function AgendarPage() {
  const supabase = createClient();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [shop, setShop] = useState<Barbershop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);

  // ✅ busy slots
  const [busyAppointments, setBusyAppointments] = useState<AppointmentBusy[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);

  // form
  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // customer fields
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    try {
      // 1) barbearia por slug
      const { data: bs, error: bsErr } = await supabase
        .from("barbershops")
        .select("id,name,slug")
        .eq("slug", slug)
        .single();

      if (bsErr || !bs) {
        setShop(null);
        setMsg("Barbearia não encontrada. Verifique o link.");
        setLoading(false);
        return;
      }

      setShop(bs as Barbershop);

      // 2) barbeiros (ativos)
      const { data: bData, error: bErr } = await supabase
        .from("barbers")
        .select("id,name,barbershop_id,active")
        .eq("barbershop_id", bs.id)
        .eq("active", true)
        .order("name", { ascending: true });

      if (bErr) setMsg("Erro ao carregar barbeiros: " + bErr.message);
      setBarbers((bData as Barber[]) || []);

      // 3) serviços
      const { data: sData, error: sErr } = await supabase
        .from("services")
        .select("id,name,barbershop_id,price,duration_minutes")
        .eq("barbershop_id", bs.id)
        .order("name", { ascending: true });

      if (sErr) setMsg((prev) => prev || "Erro ao carregar serviços: " + sErr.message);
      setServices((sData as Service[]) || []);

      // 4) horários
      const { data: hData, error: hErr } = await supabase
        .from("working_hours")
        .select("id,barbershop_id,barber_id,weekday,start_time,end_time")
        .eq("barbershop_id", bs.id)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (hErr) setMsg((prev) => prev || "Erro ao carregar horários: " + hErr.message);
      setHours((hData as WorkingHour[]) || []);
    } catch (e: any) {
      setMsg(e?.message || "Erro inesperado ao carregar dados.");
    }

    setLoading(false);
  }

  async function loadBusyAppointments(day: string, bId: string) {
    if (!day || !bId) {
      setBusyAppointments([]);
      return;
    }

    setBusyLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,barber_id,date,start_time,end_time,status")
        .eq("date", day)
        .eq("barber_id", bId)
        .in("status", ["pending", "confirmed"]);

      if (error) {
        setMsg((prev) => prev || "Não foi possível verificar horários ocupados: " + error.message);
        setBusyAppointments([]);
      } else {
        setBusyAppointments((data as AppointmentBusy[]) || []);
      }
    } catch (e: any) {
      setMsg((prev) => prev || (e?.message ?? "Erro ao buscar horários ocupados."));
      setBusyAppointments([]);
    } finally {
      setBusyLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // recarrega ocupados quando mudar data/barbeiro
  useEffect(() => {
    if (date && barberId) loadBusyAppointments(date, barberId);
    else setBusyAppointments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, barberId]);

  // sempre que mudar filtros, limpa seleção e dados
  useEffect(() => {
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
  }, [date, barberId, serviceId]);

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return services.find((s) => s.id === serviceId) || null;
  }, [serviceId, services]);

  const slotMinutes = useMemo(() => {
    const d = selectedService?.duration_minutes ?? null;
    if (!d || d <= 0) return 60;
    return d;
  }, [selectedService?.duration_minutes]);

  const busyStartTimes = useMemo(() => {
    return new Set(busyAppointments.map((a) => toHHMM(a.start_time)));
  }, [busyAppointments]);

  const hoursForDate = useMemo(() => {
    if (!date || !shop) return [];
    const wd = toWeekday(date);

    return hours.filter((h) => {
      const hw = Number(h.weekday);
      if (Number.isNaN(hw)) return false;
      if (hw !== wd) return false;

      if (barberId) {
        if (h.barber_id && h.barber_id !== barberId) return false;
      }

      return true;
    });
  }, [date, hours, barberId, shop]);

  const slots = useMemo(() => {
    if (!date) return [];
    if (!serviceId) return [];
    if (!barberId) return [];
    if (hoursForDate.length === 0) return [];

    const all: string[] = [];

    for (const h of hoursForDate) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));

      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        const hhmm = minutesToHHMM(t);

        // ✅ bloqueia ocupado
        if (busyStartTimes.has(hhmm)) continue;

        all.push(hhmm);
      }
    }

    return uniqSorted(all);
  }, [date, serviceId, barberId, hoursForDate, slotMinutes, busyStartTimes]);

  async function handleConfirm() {
    if (!shop) return;

    setMsg(null);

    if (!barberId) {
      setMsg("Selecione um barbeiro.");
      return;
    }
    if (!serviceId) {
      setMsg("Selecione um serviço.");
      return;
    }
    if (!date) {
      setMsg("Selecione uma data.");
      return;
    }
    if (!selectedTime) {
      setMsg("Selecione um horário.");
      return;
    }

    const name = clientName.trim();
    const phoneDigits = onlyDigits(clientPhone);

    if (name.length < 2) {
      setMsg("Informe seu nome (mínimo 2 caracteres).");
      return;
    }
    if (!isValidWhatsappDigits(phoneDigits)) {
      setMsg("Informe seu WhatsApp com DDD (somente números). Ex: 11999999999");
      return;
    }

    const startMin = hhmmToMinutes(selectedTime);
    const endMin = startMin + slotMinutes;

    const start_time = selectedTime; // "HH:MM"
    const end_time = minutesToHHMM(endMin); // "HH:MM"

    setSubmitting(true);

    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId,
      service_id: serviceId,
      client_id: null,
      date,
      start_time,
      end_time,
      status: "pending",
      client_name: name,
      client_phone: phoneDigits,
    });

    // ✅ NOVO: tratamento do UNIQUE
    if (error) {
      if (isUniqueViolation(error)) {
        setMsg("Esse horário acabou de ser reservado. Por favor, escolha outro.");
        // recarrega ocupados e força seleção de outro horário
        await loadBusyAppointments(date, barberId);
        setSelectedTime("");
        setSubmitting(false);
        return;
      }

      setMsg("Erro ao criar agendamento: " + error.message);
      setSubmitting(false);
      return;
    }

    setMsg("✅ Pedido de agendamento enviado! O barbeiro vai confirmar pelo WhatsApp.");
    setSubmitting(false);

    // recarrega ocupados pra sumir o horário imediatamente
    await loadBusyAppointments(date, barberId);

    // limpa seleção
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-xl">
          <p className="text-zinc-300">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-xl">
          <h1 className="text-2xl font-black">Não encontrado</h1>
          <p className="text-zinc-400 mt-2">{msg || "Verifique o link."}</p>
        </div>
      </div>
    );
  }

  const showCustomerFields = !!selectedTime;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HERO */}
      <section
        className="min-h-[55vh] flex items-center justify-center text-center relative"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1920)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div className="relative z-10 px-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            {shop.name}
          </h1>
          <p className="mt-4 text-zinc-300">
            Escolha o barbeiro, o serviço e o melhor horário.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="max-w-5xl mx-auto p-6 md:p-10">
        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200 mb-6">
            {msg}
          </div>
        )}

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-black text-yellow-400">
            Agende seu horário
          </h2>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400">Selecione o barbeiro</label>
              <select
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
              >
                <option value="">Selecione</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {barbers.length === 0 && (
                <p className="text-xs text-zinc-500 mt-2">
                  Nenhum barbeiro ativo cadastrado.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-zinc-400">Selecione o serviço</label>
              <select
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Selecione</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {serviceId && (
                <p className="text-xs text-zinc-500 mt-2">
                  Duração usada para os slots:{" "}
                  <span className="text-zinc-200 font-semibold">
                    {slotMinutes} min
                  </span>
                </p>
              )}

              {services.length === 0 && (
                <p className="text-xs text-zinc-500 mt-2">
                  Nenhum serviço cadastrado.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-zinc-400">Data</label>
              <input
                type="date"
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />

              {!!date && (
                <p className="text-xs text-zinc-500 mt-2">
                  Dia da semana:{" "}
                  <span className="text-zinc-300 font-semibold">
                    {DAYS[toWeekday(date)]}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-zinc-300 font-semibold">Horários disponíveis</p>

            {!barberId ? (
              <p className="text-zinc-500 mt-2">Selecione um barbeiro para ver os horários.</p>
            ) : !serviceId ? (
              <p className="text-zinc-500 mt-2">Selecione um serviço.</p>
            ) : !date ? (
              <p className="text-zinc-500 mt-2">Selecione uma data.</p>
            ) : busyLoading ? (
              <p className="text-zinc-500 mt-2">Verificando horários ocupados...</p>
            ) : slots.length === 0 ? (
              <p className="text-zinc-500 mt-2">
                Nenhum horário disponível para essa data.
              </p>
            ) : (
              <div className="mt-3 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                {slots.map((t) => {
                  const isSelected = selectedTime === t;

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={[
                        "h-11 rounded-xl font-black transition border",
                        isSelected
                          ? "bg-yellow-400 text-black border-yellow-300"
                          : "bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/30",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {showCustomerFields && (
            <div className="mt-8 bg-zinc-900/40 border border-white/10 rounded-2xl p-5">
              <p className="font-black text-zinc-100">Seus dados</p>
              <p className="text-sm text-zinc-400 mt-1">
                Usaremos seu WhatsApp para confirmar o horário e falar sobre cancelamentos.
              </p>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400">Nome</label>
                  <input
                    className="w-full mt-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-3 outline-none"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400">WhatsApp (com DDD)</label>
                  <input
                    className="w-full mt-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-3 outline-none"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="11999999999"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Exemplo: 11 99999-9999 (somente números).
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            className="mt-8 w-full h-14 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.01] transition disabled:opacity-50 disabled:hover:scale-100"
            disabled={
              submitting ||
              !barberId ||
              !serviceId ||
              !date ||
              !selectedTime ||
              !clientName.trim() ||
              !isValidWhatsappDigits(onlyDigits(clientPhone))
            }
            onClick={handleConfirm}
          >
            {submitting ? "Enviando..." : "Confirmar Agendamento"}
          </button>
        </div>
      </section>
    </div>
  );
}
