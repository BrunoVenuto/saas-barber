"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Shop = {
  id: string;
  name: string;
  slug: string;
  onboarded_at: string | null;
  onboarding_step: number | null;
};

type Counts = {
  services: number;
  barbers: number;
  working_hours: number;
};

function clampStep(v: number) {
  if (!Number.isFinite(v)) return 1;
  if (v < 1) return 1;
  if (v > 4) return 4;
  return v;
}

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [counts, setCounts] = useState<Counts>({ services: 0, barbers: 0, working_hours: 0 });

  const stepFromUrl = useMemo(() => {
    const raw = Number(searchParams.get("step") || "1");
    return clampStep(raw);
  }, [searchParams]);

  // =========================
  // Carrega barbearia + contagens
  // =========================
  async function load() {
    setLoading(true);
    setMsg(null);

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) {
      setMsg("Não consegui identificar sua barbearia. Faça login novamente.");
      setLoading(false);
      return;
    }

    const { data: shopData, error: shopErr } = await supabase
      .from("barbershops")
      .select("id,name,slug,onboarded_at,onboarding_step")
      .eq("id", barbershopId)
      .single();

    if (shopErr || !shopData) {
      setMsg("Erro ao carregar barbearia: " + (shopErr?.message || "sem dados"));
      setLoading(false);
      return;
    }

    setShop(shopData as Shop);

    // counts
    const [servicesRes, barbersRes, whRes] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("barbershop_id", barbershopId),
      supabase.from("barbers").select("id", { count: "exact", head: true }).eq("barbershop_id", barbershopId),
      supabase
        .from("working_hours")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershopId),
    ]);

    setCounts({
      services: servicesRes.count || 0,
      barbers: barbersRes.count || 0,
      working_hours: whRes.count || 0,
    });

    // Se já estiver onboarded, manda pro painel
    if (shopData.onboarded_at) {
      router.replace("/admin/agenda");
      return;
    }

    // Se o step no banco for maior que o da URL, sincroniza pra frente
    const dbStep = clampStep(Number(shopData.onboarding_step || 1));
    if (dbStep > stepFromUrl) {
      router.replace(`/admin/onboarding?step=${dbStep}`);
      return;
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // Regras de conclusão de step
  // =========================
  function stepIsComplete(step: number) {
    if (step === 1) return true; // exemplo: passo 1 só "continuar"
    if (step === 2) return counts.services >= 1;
    if (step === 3) return counts.barbers >= 1;
    if (step === 4) return counts.working_hours >= 1;
    return false;
  }

  function stepHint(step: number) {
    if (step === 2) return `Crie pelo menos 1 serviço (atual: ${counts.services}).`;
    if (step === 3) return `Cadastre pelo menos 1 barbeiro (atual: ${counts.barbers}).`;
    if (step === 4) return `Cadastre pelo menos 1 horário (atual: ${counts.working_hours}).`;
    return "";
  }

  // =========================
  // Avançar step (UX)
  // =========================
  async function goNext() {
    setMsg(null);

    if (!shop) return;

    const current = stepFromUrl;

    // Sempre recarrega contagens antes de validar (pra não depender do back do browser)
    await load();

    const ok = stepIsComplete(current);
    if (!ok) {
      setMsg(stepHint(current));
      return;
    }

    setSaving(true);

    // Step 4 finaliza
    if (current >= 4) {
      const { error } = await supabase
        .from("barbershops")
        .update({ onboarded_at: new Date().toISOString(), onboarding_step: 4 })
        .eq("id", shop.id);

      if (error) {
        setMsg("Erro ao finalizar onboarding: " + error.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      router.replace("/admin/agenda");
      return;
    }

    // Avança step e persiste no banco
    const next = clampStep(current + 1);

    const { error } = await supabase
      .from("barbershops")
      .update({ onboarding_step: next })
      .eq("id", shop.id);

    if (error) {
      setMsg("Erro ao avançar onboarding: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.replace(`/admin/onboarding?step=${next}`);
  }

  // =========================
  // Ir para telas de configuração e voltar
  // =========================
  function goTo(path: string) {
    // você pode manter simples, porque o botão "Próximo" agora navega corretamente.
    router.push(path);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando onboarding...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black">
            Configurar sua <span className="text-yellow-400">barbearia</span>
          </h1>
          <p className="text-zinc-400">
            Passo <span className="text-zinc-200 font-semibold">{stepFromUrl}</span> de{" "}
            <span className="text-zinc-200 font-semibold">4</span> · Termine para liberar o painel.
          </p>
          {shop?.name && (
            <p className="text-zinc-500 text-sm">
              Barbearia: <span className="text-zinc-200 font-semibold">{shop.name}</span>
            </p>
          )}
        </div>

        {msg && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-zinc-200">
            {msg}
          </div>
        )}

        {/* STEP 1 */}
        {stepFromUrl === 1 && (
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-black">1) Começo</h2>
            <p className="text-zinc-400">
              Vamos configurar o básico para você começar a usar o sistema.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => goNext()}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Próximo"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {stepFromUrl === 2 && (
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-black">2) Serviços</h2>
            <p className="text-zinc-400">
              Crie pelo menos 1 serviço em <span className="text-zinc-200 font-semibold">/admin/servicos</span>.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => goTo("/admin/servicos")}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-black"
              >
                Ir para Serviços
              </button>

              <button
                onClick={() => goNext()}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Verificando..." : "Já configurei → Próximo"}
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Status: serviços cadastrados = <span className="text-zinc-200 font-semibold">{counts.services}</span>
            </p>
          </div>
        )}

        {/* STEP 3 */}
        {stepFromUrl === 3 && (
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-black">3) Barbeiros</h2>
            <p className="text-zinc-400">
              Cadastre pelo menos 1 barbeiro em <span className="text-zinc-200 font-semibold">/admin/barbeiros</span>.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => goTo("/admin/barbeiros")}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-black"
              >
                Ir para Barbeiros
              </button>

              <button
                onClick={() => goNext()}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Verificando..." : "Já configurei → Próximo"}
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Status: barbeiros cadastrados = <span className="text-zinc-200 font-semibold">{counts.barbers}</span>
            </p>
          </div>
        )}

        {/* STEP 4 */}
        {stepFromUrl === 4 && (
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-black">4) Horários</h2>
            <p className="text-zinc-400">
              Cadastre pelo menos 1 horário em <span className="text-zinc-200 font-semibold">/admin/horarios</span>.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => goTo("/admin/horarios")}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-black"
              >
                Ir para Horários
              </button>

              <button
                onClick={() => goNext()}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50"
              >
                {saving ? "Finalizando..." : "Finalizar onboarding"}
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Status: horários cadastrados ={" "}
              <span className="text-zinc-200 font-semibold">{counts.working_hours}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
