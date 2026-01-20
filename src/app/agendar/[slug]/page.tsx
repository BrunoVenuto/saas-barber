"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Shop = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  instagram: string | null;
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
  active?: boolean | null;
};

type WorkingHour = {
  id: string;
  barbershop_id: string | null;
  barber_id: string | null;
  weekday: number | string; // 0..6
  start_time: string; // "09:00:00" ou "09:00"
  end_time: string; // "17:00:00" ou "17:00"
};

type BusyAppointment = {
  start_time: string;
  status: string | null;
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function waLink(raw: string | null) {
  const d = onlyDigits(raw || "");
  if (!d) return null;
  const final = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${final}`;
}

function igLink(raw: string | null) {
  const u = (raw || "").trim();
  if (!u) return null;
  const cleaned = u.replace("@", "");
  return `https://instagram.com/${cleaned}`;
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(Number(v));
  } catch {
    return `R$ ${v}`;
  }
}

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

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
  return Array.from(new Set(arr)).sort((a, b) => hhmmToMinutes(a) - hhmmToMinutes(b));
}

export default function AgendarPremiumPage() {
  const supabase = createClient();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [busyLoading, setBusyLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);

  // booking state
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const [busy, setBusy] = useState<string[]>([]);

  // imagens (old school / madeira / barber vibes)
  const WOOD_BG =
    "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?q=80&w=2400&auto=format&fit=crop";
  const HERO_IMG =
    "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=2400&auto=format&fit=crop";
  const SERVICES_IMG =
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=2400&auto=format&fit=crop";
  const MASTERS_IMG =
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?q=80&w=2400&auto=format&fit=crop";

  async function loadAll() {
    if (!slug) return;
    setLoading(true);
    setMsg(null);

    const { data: s, error: sErr } = await supabase
      .from("barbershops")
      .select("id,name,slug,phone,whatsapp,address,city,instagram")
      .eq("slug", slug)
      .single();

    if (sErr || !s) {
      setShop(null);
      setMsg("Barbearia não encontrada. Verifique o link.");
      setLoading(false);
      return;
    }

    setShop(s as Shop);

    const [{ data: bData, error: bErr }, { data: svData, error: svErr }, { data: hData, error: hErr }] =
      await Promise.all([
        supabase
          .from("barbers")
          .select("id,name,barbershop_id,active")
          .eq("barbershop_id", s.id)
          .eq("active", true)
          .order("name", { ascending: true }),

        supabase
          .from("services")
          .select("id,name,barbershop_id,price,duration_minutes,active")
          .eq("barbershop_id", s.id)
          .order("name", { ascending: true }),

        supabase
          .from("working_hours")
          .select("id,barbershop_id,barber_id,weekday,start_time,end_time")
          .eq("barbershop_id", s.id)
          .order("weekday", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

    if (bErr) setMsg((prev) => prev || "Erro ao carregar barbeiros: " + bErr.message);
    if (svErr) setMsg((prev) => prev || "Erro ao carregar serviços: " + svErr.message);
    if (hErr) setMsg((prev) => prev || "Erro ao carregar horários: " + hErr.message);

    setBarbers(Array.isArray(bData) ? bData : []);
    setServices(Array.isArray(svData) ? svData : []);
    setHours(Array.isArray(hData) ? hData : []);


    setLoading(false);
  }

  async function loadBusy(selectedDate: string, selectedBarberId: string) {
    if (!selectedDate || !selectedBarberId) {
      setBusy([]);
      return;
    }

    setBusyLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("appointments")
      .select("start_time,status")
      .eq("date", selectedDate)
      .eq("barber_id", selectedBarberId)
      .neq("status", "canceled")
      .order("start_time", { ascending: true });

    if (error) {
      setMsg("Erro ao carregar horários ocupados: " + error.message);
      setBusy([]);
      setBusyLoading(false);
      return;
    }

    const reserved = ((data as BusyAppointment[]) || [])
      .map((a) => toHHMM(a.start_time))
      .filter(Boolean);

    setBusy(uniqSorted(reserved));
    setBusyLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // sempre que mudar filtros, limpa seleção e campos
  useEffect(() => {
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setMsg(null);
  }, [date, barberId, serviceId]);

  // recarrega busy quando muda data/barbeiro
  useEffect(() => {
    if (!date || !barberId) {
      setBusy([]);
      return;
    }
    loadBusy(date, barberId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, barberId]);

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return services.find((s) => s.id === serviceId) || null;
  }, [serviceId, services]);

  const slotMinutes = useMemo(() => {
    const d = selectedService?.duration_minutes ?? null;
    if (!d || d <= 0) return 60;
    return d;
  }, [selectedService?.duration_minutes]);

  const hoursForDate = useMemo(() => {
    if (!date || !barberId || !shop) return [];
    const wd = toWeekday(date);

    return hours.filter((h) => {
      const hw = Number(h.weekday);
      if (Number.isNaN(hw)) return false;
      if (hw !== wd) return false;

      // aceita horário geral (barber_id null) + do barbeiro
      if (h.barber_id && h.barber_id !== barberId) return false;

      return true;
    });
  }, [date, barberId, shop, hours]);

  const slots = useMemo(() => {
    if (!date || !serviceId || !barberId) return [];
    if (hoursForDate.length === 0) return [];

    const all: string[] = [];

    for (const h of hoursForDate) {
      const start = hhmmToMinutes(toHHMM(h.start_time));
      const end = hhmmToMinutes(toHHMM(h.end_time));

      for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
        all.push(minutesToHHMM(t));
      }
    }

    const unique = uniqSorted(all);
    if (!busy || busy.length === 0) return unique;
    return unique.filter((t) => !busy.includes(t));
  }, [date, serviceId, barberId, hoursForDate, slotMinutes, busy]);

  async function handleConfirm() {
    if (!shop) return;

    setMsg(null);

    if (!barberId) return setMsg("Selecione um barbeiro.");
    if (!serviceId) return setMsg("Selecione um serviço.");
    if (!date) return setMsg("Selecione uma data.");
    if (!selectedTime) return setMsg("Selecione um horário.");

    const name = clientName.trim();
    const phone = onlyDigits(clientPhone);

    if (name.length < 2) return setMsg("Informe seu nome (mínimo 2 caracteres).");
    if (phone.length < 10 || phone.length > 15)
      return setMsg("Informe seu WhatsApp (somente números, 10 a 15 dígitos).");

    // se alguém reservou enquanto você estava na tela
    if (busy.includes(selectedTime)) {
      setMsg("Esse horário acabou de ser reservado. Escolha outro.");
      setSelectedTime("");
      return;
    }

    const startMin = hhmmToMinutes(selectedTime);
    const endMin = startMin + slotMinutes;

    const start_time = selectedTime; // HH:MM
    const end_time = minutesToHHMM(endMin); // HH:MM

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
      client_phone: phone,
    });

    if (error) {
      setMsg("Erro ao criar agendamento: " + error.message);
      setSubmitting(false);
      return;
    }

    // remove o slot imediatamente da tela
    setBusy((prev) => uniqSorted([...(prev || []), selectedTime]));

    setMsg("✅ Pedido enviado! O barbeiro vai confirmar pelo WhatsApp.");
    setSubmitting(false);

    setSelectedTime("");
    setClientName("");
    setClientPhone("");
  }

  const wa = waLink(shop?.whatsapp ?? null);
  const ig = igLink(shop?.instagram ?? null);

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
        <div className="max-w-lg w-full bg-zinc-950 border border-white/10 rounded-2xl p-6">
          <h1 className="text-2xl font-black">Barbearia não encontrada</h1>
          <p className="text-zinc-400 mt-2">{msg || "Verifique o link."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* fundo amadeirado + vinheta */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          backgroundImage: `url(${WOOD_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/60" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />

      {/* TOP NAV */}
      <header className="sticky top-0 z-40">
        <div className="px-3 sm:px-6 lg:px-10 pt-3 sm:pt-4">
          <div className="mx-auto max-w-7xl rounded-[22px] border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3">
              {/* LEFT: logo + titles */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center shrink-0">
                  <span className="text-yellow-200 font-black text-sm sm:text-base">
                    IB
                  </span>
                </div>

                {/* ✅ No mobile NÃO truncar: deixa quebrar linha se precisar */}
                <div className="min-w-0">
                  <p className="font-black tracking-tight text-sm sm:text-base leading-tight whitespace-normal break-words sm:truncate">
                    {shop.name}
                  </p>
                  {/* Subtítulo só a partir de sm (tablet/desktop) */}
                  <p className="hidden sm:block text-[11px] text-white/60 -mt-0.5 truncate">
                    {shop.city || "Barbearia"} • Old School • Premium
                  </p>
                </div>
              </div>

              {/* DESKTOP: menu + agendar */}
              <div className="hidden md:flex items-center gap-6 shrink-0">
                <nav className="flex items-center gap-6 text-sm text-white/75">
                  <a href="#sobre" className="hover:text-white transition">
                    Sobre
                  </a>
                  <a href="#servicos" className="hover:text-white transition">
                    Serviços
                  </a>
                  <a href="#mestres" className="hover:text-white transition">
                    Mestres
                  </a>
                  <a href="#contato" className="hover:text-white transition">
                    Contato
                  </a>
                </nav>

                <a
                  href="#agendar"
                  className={[
                    "inline-flex items-center justify-center",
                    "h-11 px-5",
                    "rounded-2xl font-black text-black whitespace-nowrap",
                    "bg-yellow-400 hover:brightness-110 transition",
                    "shadow-[0_0_0_1px_rgba(255,220,120,0.35),0_12px_45px_rgba(0,0,0,0.55)]",
                  ].join(" ")}
                >
                  Agendar
                </a>
              </div>

              {/* MOBILE: hamburger menu (com Agendar dentro) */}
              <div className="md:hidden shrink-0">
                <details className="relative">
                  <summary
                    aria-label="Abrir menu"
                    className={[
                      "list-none cursor-pointer select-none",
                      "h-10 w-10 rounded-2xl",
                      "bg-white/10 border border-white/10",
                      "grid place-items-center",
                      "hover:bg-white/15 transition",
                    ].join(" ")}
                  >
                    {/* Ícone hambúrguer */}
                    <span className="block w-5">
                      <span className="block h-[2px] w-5 bg-white/80 rounded" />
                      <span className="block h-[2px] w-5 bg-white/80 rounded mt-1.5" />
                      <span className="block h-[2px] w-5 bg-white/80 rounded mt-1.5" />
                    </span>
                  </summary>

                  {/* Dropdown */}
                  <div className="absolute right-0 mt-3 w-[260px] rounded-2xl border border-white/10 bg-black/85 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.75)] overflow-hidden">
                    <div className="p-3">
                      <a
                        href="#agendar"
                        className={[
                          "h-11 w-full rounded-2xl font-black text-black",
                          "bg-yellow-400 hover:brightness-110 transition",
                          "grid place-items-center",
                          "shadow-[0_0_0_1px_rgba(255,220,120,0.25)]",
                        ].join(" ")}
                      >
                        Agendar
                      </a>
                    </div>

                    <div className="border-t border-white/10">
                      <a
                        href="#sobre"
                        className="block px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
                      >
                        Sobre
                      </a>
                      <a
                        href="#servicos"
                        className="block px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
                      >
                        Serviços
                      </a>
                      <a
                        href="#mestres"
                        className="block px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
                      >
                        Mestres
                      </a>
                      <a
                        href="#contato"
                        className="block px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
                      >
                        Contato
                      </a>
                    </div>

                    <div className="px-4 py-3 text-[11px] text-white/55 border-t border-white/10">
                      {shop.city || "Barbearia"} • Old School • Premium
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* HERO */}
      <section className="px-4 sm:px-6 lg:px-10 pt-6 pb-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
            <div className="relative">
              <div
                className="h-[420px] sm:h-[520px] lg:h-[560px]"
                style={{
                  backgroundImage: `url(${HERO_IMG})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/10" />

              <div className="absolute inset-0 p-5 sm:p-8 lg:p-10 flex items-center">
                <div className="max-w-2xl">
                  <p className="text-yellow-300/90 font-black tracking-[0.22em] text-xs sm:text-sm">
                    BARBERSHOP
                  </p>

                  <h1 className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
                    <span className="text-yellow-300 drop-shadow-[0_10px_40px_rgba(0,0,0,0.65)]">
                      “{shop.name}”
                    </span>
                  </h1>

                  <p className="mt-4 text-white/80 text-base sm:text-lg leading-relaxed">
                    Brutalidade. Estilo. Carisma. <br className="hidden sm:block" />
                    Agende online em segundos — escolha o barbeiro, o serviço e o melhor horário.
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
                    <a
                      href="#agendar"
                      className={clsx(
                        "h-12 sm:h-14 px-6 rounded-2xl font-black text-black grid place-items-center",
                        "bg-yellow-400 hover:brightness-110 transition",
                        "shadow-[0_0_0_1px_rgba(255,220,120,0.45),0_18px_60px_rgba(0,0,0,0.65)]"
                      )}
                    >
                      Agendar
                    </a>

                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="h-12 sm:h-14 px-6 rounded-2xl font-black grid place-items-center bg-emerald-500 text-black hover:brightness-110 transition"
                      >
                        WhatsApp
                      </a>
                    )}

                    {ig && (
                      <a
                        href={ig}
                        target="_blank"
                        rel="noreferrer"
                        className="h-12 sm:h-14 px-6 rounded-2xl font-black grid place-items-center bg-white/10 border border-white/15 hover:bg-white/15 transition"
                      >
                        Instagram
                      </a>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="px-3 py-1 rounded-full bg-black/35 border border-white/10">
                      ⏱️ Agendamento rápido
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/35 border border-white/10">
                      💈 Barbeiros ativos
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/35 border border-white/10">
                      ✅ Confirmação no WhatsApp
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* INFO */}
            <div className="p-5 sm:p-7 lg:p-8 border-t border-white/10 bg-black/35">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Endereço</p>
                  <p className="font-bold text-white/90">{shop.address || "—"}</p>
                  <p className="text-sm text-white/70">{shop.city || ""}</p>
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Telefone</p>
                  <p className="font-bold text-white/90">{shop.phone || "—"}</p>
                  <p className="text-sm text-white/70">
                    {shop.whatsapp ? "WhatsApp disponível" : "WhatsApp não informado"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Agendamento</p>
                  <p className="font-bold text-white/90">Online</p>
                  <p className="text-sm text-white/70">Escolha seu horário logo abaixo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOOKING (o agendamento funcionando, mas com o visual premium) */}
      <section id="agendar" className="px-4 sm:px-6 lg:px-10 pb-10">
        <div className="mx-auto max-w-7xl rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <p className="text-yellow-300/90 font-black tracking-[0.22em] text-xs sm:text-sm">
                RESERVAR HORÁRIO
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black">
                Agendar agora
              </h2>
              <p className="text-white/70 mt-2">
                Selecione barbeiro, serviço e horário. Depois, informe seu WhatsApp.
              </p>
            </div>

            <div className="text-xs text-white/55">
              {busyLoading ? "Verificando horários ocupados..." : "Horários atualizados automaticamente."}
            </div>
          </div>

          {msg && (
            <div className="mt-5 rounded-2xl bg-black/40 border border-white/10 p-4 text-white/85">
              {msg}
            </div>
          )}

          <div className="mt-6 grid lg:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <label className="text-sm text-white/70 font-bold">Barbeiro</label>
              <select
                className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3 outline-none"
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
                <p className="text-xs text-white/55 mt-2">Nenhum barbeiro ativo cadastrado.</p>
              )}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <label className="text-sm text-white/70 font-bold">Serviço</label>
              <select
                className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3 outline-none"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Selecione</option>
                {services
                  .filter((x) => x.active !== false)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.price != null ? ` — ${formatBRL(s.price)}` : ""}
                    </option>
                  ))}
              </select>

              {serviceId && (
                <p className="text-xs text-white/55 mt-2">
                  Duração usada para slots:{" "}
                  <span className="text-white/85 font-black">{slotMinutes} min</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <label className="text-sm text-white/70 font-bold">Data</label>
              <input
                type="date"
                className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3 outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {!!date && (
                <p className="text-xs text-white/55 mt-2">
                  Dia: <span className="text-white/85 font-black">{DAYS[toWeekday(date)]}</span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-white/80 font-black">Horários disponíveis</p>

            {!barberId ? (
              <p className="text-white/55 mt-2">Selecione um barbeiro.</p>
            ) : !serviceId ? (
              <p className="text-white/55 mt-2">Selecione um serviço.</p>
            ) : !date ? (
              <p className="text-white/55 mt-2">Selecione uma data.</p>
            ) : busyLoading ? (
              <p className="text-white/55 mt-2">Carregando horários ocupados...</p>
            ) : slots.length === 0 ? (
              <p className="text-white/55 mt-2">Nenhum horário disponível para essa data.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {slots.map((t) => {
                  const isSelected = selectedTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={clsx(
                        "h-11 rounded-2xl font-black transition border",
                        isSelected
                          ? "bg-yellow-400 text-black border-yellow-300"
                          : "bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/30"
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dados do cliente */}
          {!!selectedTime && (
            <div className="mt-7 rounded-[28px] bg-black/35 border border-white/10 p-5">
              <p className="font-black text-white/90">Seus dados</p>
              <p className="text-sm text-white/60 mt-1">
                Usaremos seu WhatsApp para confirmar o horário e falar sobre cancelamentos.
              </p>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/70 font-bold">Nome</label>
                  <input
                    className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3 outline-none"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/70 font-bold">WhatsApp (só números)</label>
                  <input
                    className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-3 outline-none"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="DDD + número"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-white/50 mt-2">Exemplo: 31999999999</p>
                </div>
              </div>
            </div>
          )}

          <button
            className={clsx(
              "mt-6 w-full h-14 rounded-2xl font-black text-black transition",
              "bg-yellow-400 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100",
              "shadow-[0_0_0_1px_rgba(255,220,120,0.45),0_18px_60px_rgba(0,0,0,0.65)]"
            )}
            disabled={
              submitting ||
              !barberId ||
              !serviceId ||
              !date ||
              !selectedTime ||
              clientName.trim().length < 2 ||
              onlyDigits(clientPhone).length < 10
            }
            onClick={handleConfirm}
          >
            {submitting ? "Enviando..." : "Confirmar Agendamento"}
          </button>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="px-4 sm:px-6 lg:px-10 pb-10">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-6 lg:gap-10 items-stretch">
          <div className="rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
            <div className="relative">
              <div
                className="h-[240px] sm:h-[300px]"
                style={{
                  backgroundImage: `url(${SERVICES_IMG})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                <p className="text-yellow-300/90 font-black tracking-[0.22em] text-xs sm:text-sm">
                  NOSSOS SERVIÇOS
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-black">Preço & Estilo</h2>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              {services.length === 0 ? (
                <p className="text-white/65">Nenhum serviço cadastrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {services
                    .filter((x) => x.active !== false)
                    .slice(0, 10)
                    .map((sv) => (
                      <div
                        key={sv.id}
                        className="rounded-2xl bg-white/5 border border-white/10 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-black text-white/95 truncate">{sv.name}</p>
                            <p className="text-xs text-white/60 mt-1">
                              {sv.duration_minutes ? `Duração: ${sv.duration_minutes} min` : "Duração: padrão"}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="font-black text-yellow-200">{formatBRL(sv.price) || "—"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
            <h3 className="text-xl sm:text-2xl font-black">O que a gente faz melhor</h3>
            <p className="text-white/70 mt-2">Visual premium, acabamento e atendimento de respeito.</p>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              {[
                { t: "Corte clássico", d: "Linhas limpas e presença." },
                { t: "Barba premium", d: "Navalha + finalização." },
                { t: "Combo corte + barba", d: "O pacote completo." },
                { t: "Acabamento", d: "Detalhe que muda tudo." },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="font-black text-yellow-200">{x.t}</p>
                  <p className="text-sm text-white/70 mt-1">{x.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-black/35 border border-white/10 p-4">
              <p className="text-xs text-white/60 font-bold">Dica</p>
              <p className="text-sm text-white/75 mt-1">
                Quer um horário ainda hoje? Abra a agenda acima e procure os slots disponíveis.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <a
                  href="#agendar"
                  className="h-11 px-4 rounded-xl bg-yellow-400 text-black font-black grid place-items-center hover:brightness-110 transition"
                >
                  Abrir agenda
                </a>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 px-4 rounded-xl bg-emerald-500 text-black font-black grid place-items-center hover:brightness-110 transition"
                  >
                    Tirar dúvida no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MESTRES */}
      <section id="mestres" className="px-4 sm:px-6 lg:px-10 pb-12">
        <div className="mx-auto max-w-7xl rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
          <div className="relative">
            <div
              className="h-[220px] sm:h-[280px]"
              style={{
                backgroundImage: `url(${MASTERS_IMG})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
              <p className="text-yellow-300/90 font-black tracking-[0.22em] text-xs sm:text-sm">
                NOSSOS MESTRES
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black">Barbeiros</h2>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {barbers.length === 0 ? (
              <p className="text-white/65">Nenhum barbeiro cadastrado.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {barbers.map((b) => (
                  <div key={b.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center font-black text-yellow-200">
                        {b.name?.slice(0, 1)?.toUpperCase() || "B"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black truncate">{b.name}</p>
                        <p className="text-xs text-white/60 -mt-0.5">Mestre barbeiro • Atendimento premium</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <a
                        href="#agendar"
                        onClick={() => setBarberId(b.id)}
                        className="h-11 rounded-xl bg-yellow-400 text-black font-black grid place-items-center hover:brightness-110 transition"
                      >
                        Agendar com {b.name.split(" ")[0]}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-black/35 border border-white/10 p-4">
              <p className="text-sm text-white/75">
                “Mestre de verdade não é só técnica — é fazer você sair melhor do que entrou.”
              </p>
              <p className="text-xs text-white/55 mt-2">— {shop.name}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTATO / FOOTER */}
      <section id="contato" className="px-4 sm:px-6 lg:px-10 pb-10">
        <div className="mx-auto max-w-7xl rounded-[34px] border border-white/10 bg-black/30 backdrop-blur-md p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2">
              <h2 className="text-2xl sm:text-3xl font-black">Pronto pra reservar?</h2>
              <p className="text-white/70 mt-2">
                Use a agenda acima e finalize em segundos. Se precisar, chama no WhatsApp.
              </p>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <a
                  href="#agendar"
                  className={clsx(
                    "h-12 sm:h-14 px-6 rounded-2xl font-black text-black grid place-items-center",
                    "bg-yellow-400 hover:brightness-110 transition",
                    "shadow-[0_0_0_1px_rgba(255,220,120,0.45),0_18px_60px_rgba(0,0,0,0.65)]"
                  )}
                >
                  Agendar agora
                </a>

                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="h-12 sm:h-14 px-6 rounded-2xl font-black grid place-items-center bg-emerald-500 text-black hover:brightness-110 transition"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/60">Local</p>
              <p className="font-bold text-white/90">{shop.address || "—"}</p>
              <p className="text-sm text-white/70">{shop.city || ""}</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Telefone</span>
                  <span className="font-semibold text-white/90">{shop.phone || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Instagram</span>
                  <span className="font-semibold text-white/90">{shop.instagram ? shop.instagram : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 text-xs text-white/55 flex flex-col sm:flex-row gap-2 items-center justify-between">
            <p>
              © {new Date().getFullYear()} {shop.name} — Todos os direitos reservados.
            </p>
            <p className="text-white/45">Powered by Barber Premium</p>
          </div>
        </div>
      </section>
    </div>
  );
}
