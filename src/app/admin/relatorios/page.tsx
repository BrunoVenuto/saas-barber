"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/Card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Barber = { id: string; name: string; barbershop_id: string | null };

type ServiceMini = {
  id: string;
  name: string;
  duration_minutes: number | null;
  price: number | null;
};

type AppointmentRow = {
  id: string;
  date: string; // yyyy-mm-dd
  status: string;
  barber_id: string;
  service_id: string | null;
};

type Stat = { name: string; total: number };

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

function monthRange(monthKey: string) {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { startYmd: ymd(start), endYmd: ymd(end) };
}

function normalizeStatus(s: string) {
  if (s === "scheduled") return "pending";
  if (s === "done") return "completed";
  if (s === "cancelled") return "canceled";
  return s;
}

export default function AdminRelatoriosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  const [month, setMonth] = useState<string>(monthKeyNow());

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, ServiceMini>>(
    {}
  );

  const [error, setError] = useState<string | null>(null);

  // Mobile helper (para labels do gráfico)
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    function onResize() {
      setIsSmall(window.innerWidth < 420);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 0) descobrir barbershop_id do admin logado
  useEffect(() => {
    (async () => {
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        setError(userErr.message);
        return;
      }

      if (!user) {
        setError("Você precisa estar logado.");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .single();

      if (pErr) {
        setError("Erro ao carregar profile: " + pErr.message);
        return;
      }

      if (profile?.role !== "admin") {
        setError("Acesso negado: você não é admin dessa barbearia.");
        return;
      }

      if (!profile?.barbershop_id) {
        setError("Seu usuário não está vinculado a nenhuma barbearia.");
        return;
      }

      setBarbershopId(profile.barbershop_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1) carregar barbeiros do tenant
  useEffect(() => {
    if (!barbershopId) return;

    (async () => {
      setError(null);

      const { data, error } = await supabase
        .from("barbers")
        .select("id,name,barbershop_id")
        .eq("barbershop_id", barbershopId)
        .order("name", { ascending: true });

      if (error) {
        setError("Erro ao carregar barbeiros: " + error.message);
        return;
      }

      setBarbers((data as Barber[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId]);

  // 2) carregar appointments do mês (sem join embutido)
  useEffect(() => {
    if (!barbershopId) return;

    (async () => {
      setLoading(true);
      setError(null);

      const barberIds = barbers.map((b) => b.id);
      if (barberIds.length === 0) {
        setAppointments([]);
        setServicesMap({});
        setLoading(false);
        return;
      }

      const { startYmd, endYmd } = monthRange(month);

      const { data, error } = await supabase
        .from("appointments")
        .select("id,date,status,barber_id,service_id")
        .in("barber_id", barberIds)
        .gte("date", startYmd)
        .lte("date", endYmd);

      if (error) {
        setError("Erro ao carregar agendamentos: " + error.message);
        setAppointments([]);
        setServicesMap({});
        setLoading(false);
        return;
      }

      const rows: AppointmentRow[] = ((data as any[]) || []).map((a) => ({
        id: a.id,
        date: a.date,
        status: normalizeStatus(a.status),
        barber_id: a.barber_id,
        service_id: a.service_id,
      }));

      setAppointments(rows);

      const serviceIds = Array.from(
        new Set(rows.map((r) => r.service_id).filter(Boolean) as string[])
      );

      if (serviceIds.length === 0) {
        setServicesMap({});
        setLoading(false);
        return;
      }

      const { data: sData, error: sErr } = await supabase
        .from("services")
        .select("id,name,duration_minutes,price")
        .in("id", serviceIds);

      if (sErr) {
        setServicesMap({});
        setLoading(false);
        return;
      }

      const map: Record<string, ServiceMini> = {};
      (sData as any[] | null)?.forEach((s) => {
        map[s.id] = {
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes ?? null,
          price: s.price ?? null,
        };
      });

      setServicesMap(map);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId, barbers, month]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === "pending").length;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const completed = appointments.filter((a) => a.status === "completed").length;
    const canceled = appointments.filter((a) => a.status === "canceled").length;

    let revenue = 0;
    for (const ap of appointments) {
      if (ap.status !== "completed") continue;
      if (!ap.service_id) continue;
      const s = servicesMap[ap.service_id];
      if (!s?.price) continue;
      revenue += Number(s.price);
    }

    return { total, pending, confirmed, completed, canceled, revenue };
  }, [appointments, servicesMap]);

  const byBarber = useMemo<Stat[]>(() => {
    const map: Record<string, number> = {};
    const barberNameById: Record<string, string> = {};
    barbers.forEach((b) => (barberNameById[b.id] = b.name));

    appointments.forEach((a) => {
      const name = barberNameById[a.barber_id] || "Desconhecido";
      map[name] = (map[name] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [appointments, barbers]);

  const byService = useMemo<Stat[]>(() => {
    const map: Record<string, number> = {};

    appointments.forEach((a) => {
      const name = a.service_id ? servicesMap[a.service_id]?.name : null;
      const label = name || "Desconhecido";
      map[label] = (map[label] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [appointments, servicesMap]);

  const chartData = useMemo(() => {
    return [
      { name: "Pendentes", value: kpis.pending },
      { name: "Confirmados", value: kpis.confirmed },
      { name: "Concluídos", value: kpis.completed },
      { name: "Cancelados", value: kpis.canceled },
    ].filter((x) => x.value > 0);
  }, [kpis]);

  const COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444"];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando relatórios...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">📊 Relatórios</h1>
            <p className="text-zinc-400 mt-2 text-sm sm:text-base">
              Resumo e rankings do mês selecionado (apenas sua barbearia).
            </p>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 w-full md:w-auto">
            <label className="block text-sm text-zinc-400 mb-2">Mês</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full md:w-[220px] bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none text-white"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* KPIs - mobile-first */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
          <Card>
            <p className="text-sm opacity-70">Total</p>
            <p className="text-3xl sm:text-4xl font-black text-orange-400">
              {kpis.total}
            </p>
          </Card>

          <Card>
            <p className="text-sm opacity-70">Pendentes</p>
            <p className="text-3xl sm:text-4xl font-black text-yellow-300">
              {kpis.pending}
            </p>
          </Card>

          <Card>
            <p className="text-sm opacity-70">Confirmados</p>
            <p className="text-3xl sm:text-4xl font-black text-blue-300">
              {kpis.confirmed}
            </p>
          </Card>

          <Card>
            <p className="text-sm opacity-70">Concluídos</p>
            <p className="text-3xl sm:text-4xl font-black text-green-400">
              {kpis.completed}
            </p>
          </Card>

          <Card>
            <p className="text-sm opacity-70">Cancelados</p>
            <p className="text-3xl sm:text-4xl font-black text-red-400">
              {kpis.canceled}
            </p>
          </Card>

          <Card>
            <p className="text-sm opacity-70">Faturamento (estim.)</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-300">
              R$ {kpis.revenue.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Soma de serviços dos “concluídos”.
            </p>
          </Card>
        </div>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Gráfico */}
          <Card>
            <h2 className="text-lg sm:text-xl font-bold mb-4">
              Distribuição por status (mês)
            </h2>

            {chartData.length === 0 ? (
              <p className="text-zinc-400">Sem dados no período.</p>
            ) : (
              <div className="w-full">
                {/* Wrapper “à prova de mobile” */}
                <div className="mx-auto w-full max-w-[320px] sm:max-w-[360px] md:max-w-[420px] aspect-square overflow-hidden">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={isSmall ? 92 : 120}
                        label={!isSmall}
                      >
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda (melhor no mobile do que label no gráfico) */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {chartData.map((d, i) => (
                    <div
                      key={d.name}
                      className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="font-black">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Ranking barbeiros */}
          <Card>
            <h2 className="text-lg sm:text-xl font-bold mb-4">
              Ranking de barbeiros (mês)
            </h2>

            {byBarber.length === 0 ? (
              <p className="text-zinc-400">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {byBarber.map((b, i) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between gap-3 border-b border-white/10 pb-2"
                  >
                    <span className="text-sm sm:text-base truncate">
                      {i + 1}. {b.name}
                    </span>
                    <span className="font-bold shrink-0">{b.total}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Ranking serviços */}
        <Card>
          <h2 className="text-lg sm:text-xl font-bold mb-4">
            Serviços mais realizados (mês)
          </h2>

          {byService.length === 0 ? (
            <p className="text-zinc-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {byService.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-3 border-b border-white/10 pb-2"
                >
                  <span className="text-sm sm:text-base truncate">
                    {i + 1}. {s.name}
                  </span>
                  <span className="font-bold shrink-0">{s.total}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
