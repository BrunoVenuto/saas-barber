"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: string | null;
  barbershop_id: string | null;
};

type Shop = {
  id: string;
  name: string;
  plan: string | null;
};

type PlanKey = "start" | "profissional" | "premium";

function clsx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function AdminPlanosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);

  const selectedPlan = useMemo<PlanKey | null>(() => {
    const p = (shop?.plan || "").toLowerCase();
    if (p === "start") return "start";
    if (p === "profissional" || p === "professional" || p === "pro") return "profissional";
    if (p === "premium") return "premium";
    return null;
  }, [shop?.plan]);

  const plans = useMemo(
    () => [
      {
        key: "start" as const,
        title: "Start",
        subtitle: "Para quem está começando",
        price: "R$ 39",
        period: "/mês",
        badge: null as string | null,
        features: [
          "✅ 1 barbearia",
          "✅ Até 2 barbeiros",
          "✅ Agenda online",
          "✅ Confirmação por WhatsApp",
          "❌ Sem personalização visual",
        ],
        cta: "Selecionar Start",
      },
      {
        key: "profissional" as const,
        title: "Profissional",
        subtitle: "Para barbearias de verdade",
        price: "R$ 79",
        period: "/mês",
        badge: "MAIS VENDIDO",
        features: [
          "✅ 1 barbearia",
          "✅ Barbeiros ilimitados",
          "✅ Agenda online",
          "✅ Confirmação e cancelamento por WhatsApp",
          "✅ Landing page premium",
          "✅ Painel do dono e do barbeiro",
        ],
        cta: "Selecionar Profissional",
      },
      {
        key: "premium" as const,
        title: "Premium",
        subtitle: "Para quem quer escalar",
        price: "R$ 129",
        period: "/mês",
        badge: null as string | null,
        features: [
          "✅ Múltiplas barbearias",
          "✅ Barbeiros ilimitados",
          "✅ Personalização de cores e logo",
          "✅ Prioridade no suporte",
          "✅ Tudo do plano Profissional",
        ],
        cta: "Quero Premium",
      },
    ],
    []
  );

  async function load() {
    setLoading(true);
    setError(null);
    setMsg(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

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

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (pErr) {
      setError("Erro ao carregar profile: " + pErr.message);
      setLoading(false);
      return;
    }

    const p = prof as Profile;

    if (p.role !== "admin") {
      setError("Acesso negado: você não é admin dessa barbearia.");
      setLoading(false);
      return;
    }

    if (!p.barbershop_id) {
      setError("Seu usuário admin não está vinculado a nenhuma barbearia.");
      setLoading(false);
      return;
    }

    setProfile(p);

    // ⚠️ Aqui é o ponto principal: pegamos a barbearia PELO ID (barbershop_id).
    // Nada de owner_id (que não existe) => evita o 400.
    const { data: bs, error: bsErr } = await supabase
      .from("barbershops")
      .select("id, name, plan")
      .eq("id", p.barbershop_id)
      .single();

    if (bsErr) {
      setError(
        "Erro ao carregar barbearia. " +
          bsErr.message +
          "\n\nSe aparecer algo sobre a coluna 'plan', precisamos criar essa coluna no Supabase."
      );
      setLoading(false);
      return;
    }

    setShop(bs as Shop);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPlan(plan: PlanKey) {
    if (!shop) return;

    setSaving(plan);
    setError(null);
    setMsg(null);

    const { error } = await supabase
      .from("barbershops")
      .update({ plan })
      .eq("id", shop.id);

    if (error) {
      setError("Erro ao salvar plano: " + error.message);
      setSaving(null);
      return;
    }

    setShop((prev) => (prev ? { ...prev, plan } : prev));
    setMsg("✅ Plano atualizado com sucesso!");
    setSaving(null);
  }

  function openWhatsAppSales() {
    const text =
      "Olá! Quero contratar o plano Premium do Barber Premium e tirar dúvidas sobre múltiplas barbearias e personalização.";
    window.open(`https://wa.me/5531995453632?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando planos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl sm:text-3xl font-black">
            💳 Planos <span className="text-yellow-400">da barbearia</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Barbearia:{" "}
            <span className="text-white font-semibold">{shop?.name || "—"}</span>
          </p>

          {selectedPlan && (
            <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-zinc-950 border border-white/10 px-3 py-2">
              <span className="text-xs text-zinc-400">Plano atual:</span>
              <span className="text-sm font-black text-yellow-300 uppercase">
                {selectedPlan}
              </span>
            </div>
          )}
        </header>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4 whitespace-pre-line">
            {error}
          </div>
        )}

        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
            {msg}
          </div>
        )}

        {/* MOBILE-FIRST: 1 coluna no mobile, 2 no md, 3 no lg */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isSelected = selectedPlan === p.key;

            const cardBase =
              "rounded-[28px] border bg-zinc-950/60 backdrop-blur-md p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]";

            const cardSelected =
              "border-yellow-400 shadow-[0_0_0_1px_rgba(255,214,70,0.35),0_25px_80px_rgba(0,0,0,0.8)]";

            const cardNormal = "border-white/10";

            return (
              <div
                key={p.key}
                className={clsx(cardBase, isSelected ? cardSelected : cardNormal)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{p.title}</h2>
                    <p className="text-white/60 text-sm mt-1">{p.subtitle}</p>
                  </div>

                  {p.badge && (
                    <span className="shrink-0 text-[10px] font-black px-3 py-1 rounded-full bg-yellow-400 text-black">
                      {p.badge}
                    </span>
                  )}
                </div>

                <div className="mt-6">
                  <p className="text-4xl font-black text-yellow-300">
                    {p.price}
                    <span className="text-lg text-white/60">{p.period}</span>
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-white/80">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>

                <div className="mt-8 space-y-2">
                  {p.key === "premium" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPlan(p.key)}
                        disabled={saving !== null}
                        className={clsx(
                          "h-12 w-full rounded-xl font-black transition",
                          isSelected
                            ? "bg-yellow-400 text-black hover:brightness-110"
                            : "bg-white/10 border border-white/15 hover:bg-white/15"
                        )}
                      >
                        {saving === p.key
                          ? "Salvando..."
                          : isSelected
                          ? "✅ Premium selecionado"
                          : p.cta}
                      </button>

                      <button
                        type="button"
                        onClick={openWhatsAppSales}
                        className="h-12 w-full rounded-xl bg-emerald-500 text-black font-black hover:brightness-110 transition"
                      >
                        Falar no WhatsApp
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlan(p.key)}
                      disabled={saving !== null}
                      className={clsx(
                        "h-12 w-full rounded-xl font-black transition",
                        isSelected
                          ? "bg-yellow-400 text-black hover:brightness-110"
                          : "bg-white/10 border border-white/15 hover:bg-white/15"
                      )}
                    >
                      {saving === p.key
                        ? "Salvando..."
                        : isSelected
                        ? "✅ Selecionado"
                        : p.cta}
                    </button>
                  )}

                  <p className="text-xs text-white/45">
                    A mudança é aplicada nesta barbearia (tenant) e pode refletir em limites/recursos.
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-zinc-950/50 backdrop-blur-md p-5">
          <h3 className="font-black text-yellow-300">Como esses planos funcionam</h3>
          <div className="mt-3 space-y-2 text-sm text-white/75 leading-relaxed">
            <p>
              • <span className="text-white font-semibold">Start</span>: ideal para barbearia pequena (até 2 barbeiros),
              com agenda online e confirmação no WhatsApp.
            </p>
            <p>
              • <span className="text-white font-semibold">Profissional</span>: desbloqueia barbeiros ilimitados,
              landing premium e o fluxo completo (confirmar/cancelar) para reduzir no-show.
            </p>
            <p>
              • <span className="text-white font-semibold">Premium</span>: pensado para quem tem múltiplas unidades e
              quer personalização (logo/cores) + prioridade no suporte.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
