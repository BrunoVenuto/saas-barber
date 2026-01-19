"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/Card";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type BarberStat = {
  name: string;
  total: number;
};

type ServiceStat = {
  name: string;
  total: number;
};

export default function AdminRelatoriosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [scheduled, setScheduled] = useState(0);
  const [done, setDone] = useState(0);
  const [cancelled, setCancelled] = useState(0);

  const [byBarber, setByBarber] = useState<BarberStat[]>([]);
  const [byService, setByService] = useState<ServiceStat[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        status,
        barbers(name),
        services(name)
      `
      );

    if (error || !appointments) {
      alert("Erro ao carregar relatórios");
      setLoading(false);
      return;
    }

    // Totais
    const totalCount = appointments.length;
    const scheduledCount = appointments.filter(
      (a) => a.status === "scheduled"
    ).length;
    const doneCount = appointments.filter((a) => a.status === "done").length;
    const cancelledCount = appointments.filter(
      (a) => a.status === "cancelled"
    ).length;

    setTotal(totalCount);
    setScheduled(scheduledCount);
    setDone(doneCount);
    setCancelled(cancelledCount);

    // Agrupar por barbeiro
    const barberMap: Record<string, number> = {};
    appointments.forEach((a: any) => {
      const name = a.barbers?.name || "Desconhecido";
      barberMap[name] = (barberMap[name] || 0) + 1;
    });

    const barberRanking = Object.entries(barberMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    setByBarber(barberRanking);

    // Agrupar por serviço
    const serviceMap: Record<string, number> = {};
    appointments.forEach((a: any) => {
      const name = a.services?.name || "Desconhecido";
      serviceMap[name] = (serviceMap[name] || 0) + 1;
    });

    const serviceRanking = Object.entries(serviceMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    setByService(serviceRanking);

    setLoading(false);
  }

  const chartData = [
    { name: "Agendados", value: scheduled },
    { name: "Concluídos", value: done },
    { name: "Cancelados", value: cancelled },
  ];

  const COLORS = ["#f59e0b", "#22c55e", "#ef4444"];

  if (loading) return <div className="p-10">Carregando relatórios...</div>;

  return (
    <div className="p-10 space-y-10">
      <h1 className="text-3xl font-black text-white">
        📊 Relatórios do Sistema
      </h1>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm opacity-70">Total</p>
          <p className="text-4xl font-black text-orange-400">{total}</p>
        </Card>

        <Card>
          <p className="text-sm opacity-70">Agendados</p>
          <p className="text-4xl font-black text-yellow-400">
            {scheduled}
          </p>
        </Card>

        <Card>
          <p className="text-sm opacity-70">Concluídos</p>
          <p className="text-4xl font-black text-green-400">{done}</p>
        </Card>

        <Card>
          <p className="text-sm opacity-70">Cancelados</p>
          <p className="text-4xl font-black text-red-400">
            {cancelled}
          </p>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <h2 className="text-xl font-bold mb-4">
          Distribuição dos Atendimentos
        </h2>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Ranking barbeiros */}
      <Card>
        <h2 className="text-xl font-bold mb-4">
          Ranking de Barbeiros
        </h2>
        <div className="space-y-2">
          {byBarber.map((b, i) => (
            <div
              key={b.name}
              className="flex justify-between border-b border-white/10 pb-2"
            >
              <span>
                {i + 1}. {b.name}
              </span>
              <span className="font-bold">{b.total}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Ranking serviços */}
      <Card>
        <h2 className="text-xl font-bold mb-4">
          Serviços Mais Realizados
        </h2>
        <div className="space-y-2">
          {byService.map((s, i) => (
            <div
              key={s.name}
              className="flex justify-between border-b border-white/10 pb-2"
            >
              <span>
                {i + 1}. {s.name}
              </span>
              <span className="font-bold">{s.total}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
