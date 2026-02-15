"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/Card";

type PlanKey = "start" | "pro" | "premium";

type Barbershop = {
  id: string;
  name: string;
  plan: PlanKey | null;
};

type PlanLimits = {
  barbershops: number;
  barbers: number;
  services: number;
  customization: boolean;
  reports: boolean;
};

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

type PlanRow = {
  id: string;
  name: string;
  plan: string | null;
};

type ApiErr = { error: string };

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function planLabel(p: PlanKey) {
  if (p === "start") return "Start";
  if (p === "pro") return "Profissional";
  return "Premium";
}

function planPrice(p: PlanKey) {
  if (p === "start") return "R$ 39/mês";
  if (p === "pro") return "R$ 79/mês";
  return "R$ 129/mês";
}

function planLimits(p: PlanKey): PlanLimits {
  if (p === "start") {
    return {
      barbershops: 1,
      barbers: 2,
      services: 20,
      customization: false,
      reports: true,
    };
  }
  if (p === "pro") {
    return {
      barbershops: 1,
      barbers: 9999,
      services: 9999,
      customization: true,
      reports: true,
    };
  }
  return {
    barbershops: 9999,
    barbers: 9999,
    services: 9999,
    customization: true,
    reports: true,
  };
}

function isApiErr(v: unknown): v is ApiErr {
  if (typeof v !== "object" || v === null) return false;
  return "error" in v && typeof (v as { error?: unknown }).error === "string";
}

function PlanBadge({ plan }: { plan: PlanKey }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-300/25 text-yellow-200 text-xs font-black">
      Plano atual: {planLabel(plan)}
    </span>
  );
}

export default function AdminAssinaturaPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [shop, setShop] = useState<Barbershop | null>(null);
  const [selected, setSelected] = useState<PlanKey>("pro");

  // Carrega barbershop do admin logado via profiles.barbershop_id
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }
      if (!user) {
        setError("Você precisa estar logado.");
        setLoading(false);
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .single<ProfileRow>();

      if (!mounted) return;

      if (pErr) {
        setError("Erro ao carregar profile: " + pErr.message);
        setLoading(false);
        return;
      }

      if ((profile?.role ?? null) !== "admin") {
        setError("Acesso negado: você não é admin.");
        setLoading(false);
        return;
      }

      if (!profile?.barbershop_id) {
        setError("Seu usuário não está vinculado a nenhuma barbearia.");
        setLoading(false);
        return;
      }

      const { data: bs, error: bErr } = await supabase
        .from("barbershops")
        .select("id,name,plan")
        .eq("id", profile.barbershop_id)
        .single<PlanRow>();

      if (!mounted) return;

      if (bErr || !bs) {
        setError("Erro ao carregar barbearia: " + (bErr?.message || "—"));
        setLoading(false);
        return;
      }

      const plan: PlanKey =
        bs.plan === "start" || bs.plan === "pro" || bs.plan === "premium"
          ? bs.plan
          : "pro";

      setShop({
        id: bs.id,
        name: bs.name,
        plan,
      });

      setSelected(plan);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlan: PlanKey = shop?.plan ?? "pro";
  const current = useMemo<PlanLimits>(
    () => planLimits(currentPlan),
    [currentPlan],
  );

  async function savePlan(nextPlan: PlanKey) {
    if (!shop) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan: nextPlan }),
    });

    const raw: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      setError(isApiErr(raw) ? raw.error : "Falha ao atualizar plano.");
      setBusy(false);
      return;
    }

    setShop((prev) => (prev ? { ...prev, plan: nextPlan } : prev));
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-zinc-300 text-sm">Carregando assinatura...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl p-4 space-y-5 sm:p-6 sm:space-y-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black sm:text-3xl">💳 Assinatura</h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Controle de plano, limites e upgrade da sua barbearia.
          </p>

          {shop && <PlanBadge plan={currentPlan} />}
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-3 text-sm whitespace-pre-line sm:p-4 sm:text-base">
            {error}
          </div>
        )}

        {/* Resumo atual */}
        <Card>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/70">Barbearia</p>
            <p className="text-xl font-black sm:text-2xl">
              {shop?.name || "—"}
            </p>

            {/* Mobile-first: 1 col → 2 col (sm) → 5 col (lg) */}
            <div className="grid grid-cols-1 gap-3 mt-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/60">Plano</p>
                <p className="text-lg font-black text-yellow-300">
                  {planLabel(currentPlan)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/60">Barbeiros</p>
                <p className="text-lg font-black">
                  {current.barbers >= 9999 ? "Ilimitado" : current.barbers}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/60">Serviços</p>
                <p className="text-lg font-black">
                  {current.services >= 9999 ? "Ilimitado" : current.services}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/60">Personalização</p>
                <p className="text-lg font-black">
                  {current.customization ? "Sim" : "Não"}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/60">Relatórios</p>
                <p className="text-lg font-black">
                  {current.reports ? "Sim" : "Não"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Cards de planos */}
        <div className="space-y-2">
          <h2 className="text-lg font-black sm:text-xl">Planos</h2>
          <p className="text-sm text-white/70">
            Clique em um plano para selecionar e depois confirme.
          </p>
        </div>

        {/* Mobile-first: 1 coluna → 3 colunas no md */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["start", "pro", "premium"] as const).map((p) => {
            const isSelected = selected === p;
            const isCurrent = currentPlan === p;
            const lim = planLimits(p);

            return (
              <button
                key={p}
                type="button"
                onClick={() => setSelected(p)}
                className={clsx(
                  "text-left rounded-[28px] p-5 border transition",
                  "bg-black/35 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                  isSelected
                    ? "border-yellow-400 shadow-[0_0_0_1px_rgba(250,204,21,0.25),0_18px_70px_rgba(0,0,0,0.65)]"
                    : "border-white/10 active:border-white/20 sm:hover:border-white/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black">{planLabel(p)}</p>
                    <p className="text-sm text-white/60 mt-1">{planPrice(p)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {isCurrent && (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 font-black">
                        ATUAL
                      </span>
                    )}

                    {p === "pro" && (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-yellow-400/15 border border-yellow-300/25 text-yellow-200 font-black">
                        MAIS VENDIDO
                      </span>
                    )}
                  </div>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-white/80">
                  <li>
                    ✅ Barbearias:{" "}
                    {lim.barbershops >= 9999 ? "Ilimitadas" : lim.barbershops}
                  </li>
                  <li>
                    ✅ Barbeiros:{" "}
                    {lim.barbers >= 9999 ? "Ilimitados" : lim.barbers}
                  </li>
                  <li>
                    ✅ Serviços:{" "}
                    {lim.services >= 9999 ? "Ilimitados" : lim.services}
                  </li>
                  <li>✅ Relatórios: {lim.reports ? "Sim" : "Não"}</li>
                  <li>
                    ✅ Personalização:{" "}
                    <span
                      className={
                        lim.customization ? "text-emerald-200" : "text-red-200"
                      }
                    >
                      {lim.customization ? "Sim" : "Não"}
                    </span>
                  </li>
                </ul>

                <div className="mt-5">
                  <span
                    className={clsx(
                      "inline-flex items-center justify-center h-11 w-full rounded-2xl font-black",
                      isSelected
                        ? "bg-yellow-400 text-black"
                        : "bg-white/10 border border-white/10 text-white",
                    )}
                  >
                    {isSelected ? "Selecionado" : "Selecionar"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirmação */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-white/70">Plano selecionado</p>
              <p className="text-xl font-black text-yellow-300">
                {planLabel(selected)}
              </p>
              <p className="text-sm text-white/60 mt-1">
                {planPrice(selected)}
              </p>
            </div>

            <button
              type="button"
              disabled={busy || !shop || selected === currentPlan}
              onClick={() => savePlan(selected)}
              className="h-12 px-6 rounded-2xl bg-yellow-400 text-black font-black active:scale-[0.99] sm:hover:brightness-110 transition disabled:opacity-50"
            >
              {selected === currentPlan
                ? "Já é o plano atual"
                : busy
                  ? "Salvando..."
                  : "Confirmar plano"}
            </button>
          </div>

          <div className="mt-4 text-xs text-white/55">
            * Isso é um upgrade “manual” por enquanto (sem cobrança automática).
            Depois a gente pluga Stripe/Mercado Pago.
          </div>
        </Card>
      </div>
    </div>
  );
}
