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
  end_time: string;   // "17:00:00" ou "17:00"
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toWeekday(dateStr: string) {
  // YYYY-MM-DD -> weekday (0..6)
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
  return Array.from(new Set(arr)).sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));
}

export default function AgendarPage() {
  const supabase = createClient();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [shop, setShop] = useState<Barbershop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);

  // form
  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

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

      if (bErr) {
        setMsg("Erro ao carregar barbeiros: " + bErr.message);
      }
      setBarbers((bData as Barber[]) || []);

      // 3) serviços
      const { data: sData, error: sErr } = await supabase
        .from("services")
        .select("id,name,barbershop_id,price,duration_minutes")
        .eq("barbershop_id", bs.id)
        .order("name", { ascending: true });

      if (sErr) {
        setMsg((prev) => prev || "Erro ao carregar serviços: " + sErr.message);
      }
      setServices((sData as Service[]) || []);

      // 4) horários
      const { data: hData, error: hErr } = await supabase
        .from("working_hours")
        .select("id,barbershop_id,barber_id,weekday,start_time,end_time")
        .eq("barbershop_id", bs.id)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (hErr) {
        setMsg((prev) => prev || "Erro ao carregar horários: " + hErr.message);
      }
      setHours((hData as WorkingHour[]) || []);
    } catch (e: any) {
      setMsg(e?.message || "Erro inesperado ao carregar dados.");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!slug) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // sempre que mudar data/barbeiro/serviço, limpa o slot selecionado
  useEffect(() => {
    setSelectedTime("");
  }, [date, barberId, serviceId]);

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return services.find((s) => s.id === serviceId) || null;
  }, [serviceId, services]);

  const slotMinutes = useMemo(() => {
    // se não tiver duration, usa 60
    const d = selectedService?.duration_minutes ?? null;
    if (!d || d <= 0) return 60;
    return d;
  }, [selectedService?.duration_minutes]);

  // horários filtrados pela data + (opcional) barbeiro
  const hoursForDate = useMemo(() => {
    if (!date || !shop) return [];
    const wd = toWeekday(date);

    return hours.filter((h) => {
      const hw = Number(h.weekday);
      if (Number.isNaN(hw)) return false;
      if (hw !== wd) return false;

      // se escolheu barbeiro: aceita horário geral (barber_id null) + horários do barbeiro
      if (barberId) {
        if (h.barber_id && h.barber_id !== barberId) return false;
      }

      return true;
    });
  }, [date, hours, barberId, shop]);

  // gera slots de hora em hora (ou duration) dentro do intervalo de working_hours
  const slots = useMemo(() => {
    if (!date) return [];
    if (!serviceId) return [];
    if (hoursForDate.length === 0) return [];

    const all: string[] = [];

    for (const h of hoursForDate) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));

      // slots começam no start e vão até end - duração
      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        all.push(minutesToHHMM(t));
      }
    }

    return uniqSorted(all);
  }, [date, serviceId, hoursForDate, slotMinutes]);

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
                <option value="">(Qualquer)</option>
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

            {!serviceId ? (
              <p className="text-zinc-500 mt-2">Selecione um serviço.</p>
            ) : !date ? (
              <p className="text-zinc-500 mt-2">Selecione uma data.</p>
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

          <button
            className="mt-8 w-full h-14 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.01] transition disabled:opacity-50"
            disabled={!serviceId || !date || !selectedTime}
            onClick={() => {
              // Próximo passo: aqui você vai criar o appointment (quando você quiser, eu monto o insert completo)
              alert(
                `Confirmar: ${shop.name}\nBarbeiro: ${barberId || "Qualquer"}\nServiço: ${serviceId}\nData: ${date}\nHora: ${selectedTime}`
              );
            }}
          >
            Confirmar Agendamento
          </button>
        </div>
      </section>
    </div>
  );
}
