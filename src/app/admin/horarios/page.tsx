"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: string;
  barbershop_id: string | null;
  name?: string | null;
};

type WorkingHour = {
  id: string;
  barber_id: string | null;
  barbershop_id: string | null;
  weekday: number; // 0..6
  start_time: string; // "09:00"
  end_time: string; // "17:00"
};

const DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export default function HorariosPage() {
  const supabase = createClient();
  const router = useRouter();

  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  const [weekday, setWeekday] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  function validateTimes() {
    if (!startTime || !endTime) return "Preencha hora início e hora fim.";
    if (startTime >= endTime) return "Hora início deve ser menor que hora fim.";
    return null;
  }

  async function loadProfileAndShop() {
    // 1) user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw new Error(userErr.message);
    if (!user) {
      router.replace("/login");
      return { prof: null as any, shopId: null as string | null };
    }

    // 2) profile
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id, name")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) throw new Error("Perfil não encontrado no profiles.");

    const p = prof as Profile;

    // ✅ só admin de barbearia
    if (p.role !== "admin") {
      throw new Error("Acesso negado: apenas administradores podem acessar esta página.");
    }

    if (!p.barbershop_id) {
      throw new Error("Você é admin da plataforma (barbershop_id = NULL). Esta tela é apenas para admin de uma barbearia.");
    }

    return { prof: p, shopId: p.barbershop_id };
  }

  async function loadHours(shopId: string) {
    const { data, error } = await supabase
      .from("working_hours")
      .select("id, barber_id, barbershop_id, weekday, start_time, end_time")
      .eq("barbershop_id", shopId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw new Error("Erro ao carregar horários: " + error.message);

    setHours((data as any) || []);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const { prof, shopId } = await loadProfileAndShop();
      if (!prof || !shopId) return;

      setProfile(prof);
      setBarbershopId(shopId);

      await loadHours(shopId);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    const err = validateTimes();
    if (err) {
      alert(err);
      return;
    }

    if (!barbershopId) {
      alert("Não foi possível identificar a barbearia.");
      return;
    }

    const { error } = await supabase.from("working_hours").insert({
      barbershop_id: barbershopId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      console.error("❌ Erro ao salvar:", error);
      alert("Erro ao salvar horário: " + error.message);
      return;
    }

    await loadHours(barbershopId);
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja remover este horário?")) return;

    const { error } = await supabase.from("working_hours").delete().eq("id", id);

    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }

    if (barbershopId) await loadHours(barbershopId);
  }

  if (loading) {
    return <div className="p-8 text-white">Carregando horários...</div>;
  }

  return (
    <div className="p-8 space-y-6 text-white">
      <h1 className="text-3xl font-bold text-yellow-400">
        Horários de Funcionamento
      </h1>

      {/* FORM */}
      <div className="bg-zinc-900 p-6 rounded-lg space-y-4 max-w-xl border border-white/10">
        <div>
          <label className="block mb-1">Dia da semana</label>
          <select
            className="w-full p-2 rounded bg-black border border-white/10"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Hora início</label>
          <input
            type="time"
            className="w-full p-2 rounded bg-black border border-white/10"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Hora fim</label>
          <input
            type="time"
            className="w-full p-2 rounded bg-black border border-white/10"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <button
          onClick={handleAdd}
          className="bg-yellow-400 text-black font-bold px-4 py-2 rounded hover:opacity-90"
        >
          ➕ Adicionar horário
        </button>

        <div className="text-xs text-zinc-400">
          Logado como:{" "}
          <span className="text-zinc-200 font-semibold">
            {profile?.name || profile?.id}
          </span>{" "}
          • barbershop_id:{" "}
          <span className="text-zinc-200 font-semibold">{barbershopId}</span>
        </div>
      </div>

      {/* LISTA */}
      <div className="space-y-3">
        {hours.length === 0 && (
          <p className="opacity-70">Nenhum horário cadastrado.</p>
        )}

        {hours.map((h) => (
          <div
            key={h.id}
            className="bg-zinc-900 p-4 rounded flex justify-between items-center border border-white/10"
          >
            <div>
              <p className="font-bold text-yellow-400">{DAYS[h.weekday]}</p>
              <p className="opacity-80">
                {h.start_time} - {h.end_time}
              </p>
            </div>

            <button
              onClick={() => handleDelete(h.id)}
              className="bg-red-600 text-white px-3 py-1 rounded"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
