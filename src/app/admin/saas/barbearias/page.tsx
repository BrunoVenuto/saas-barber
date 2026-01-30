"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Plan = "start" | "pro" | "premium";

type Shop = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: Plan;
};

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | null;
  plan: string | null;
};

const PLAN_PRICE: Record<Plan, number> = {
  start: 39,
  pro: 79,
  premium: 129,
};

function planLabel(p: Plan) {
  switch (p) {
    case "start":
      return "Start";
    case "pro":
      return "Pro";
    case "premium":
      return "Premium";
  }
}

function moneyBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isPlan(v: string): v is Plan {
  return v === "start" || v === "pro" || v === "premium";
}

function getErrorMessage(json: unknown): string {
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: unknown }).error;
    if (typeof err === "string") return err;
    if (err) return String(err);
  }
  return "";
}

export default function SaaSBarbershopsPage() {
  const supabase = createClient();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("barbershops")
      .select("id,name,slug,is_active,plan")
      .order("name", { ascending: true });

    if (error) {
      setMsg(error.message);
      setShops([]);
      setLoading(false);
      return;
    }

    const rows: ShopRow[] = (data ?? []) as ShopRow[];

    const normalized: Shop[] = rows.map((row) => {
      const rawPlan = (row.plan ?? "").trim().toLowerCase();
      const plan: Plan = isPlan(rawPlan) ? rawPlan : "pro";

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        is_active: Boolean(row.is_active),
        plan,
      };
    });

    setShops(normalized);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = shops.length;
    const active = shops.filter((s) => s.is_active);
    const activeTotal = active.length;

    const counts: Record<Plan, number> = { start: 0, pro: 0, premium: 0 };
    for (const s of active) counts[s.plan] += 1;

    const mrr =
      counts.start * PLAN_PRICE.start +
      counts.pro * PLAN_PRICE.pro +
      counts.premium * PLAN_PRICE.premium;

    return { total, activeTotal, counts, mrr };
  }, [shops]);

  async function handleCreate() {
    setMsg(null);

    if (!name.trim()) return setMsg("Informe o nome da barbearia.");
    if (!adminEmail.trim())
      return setMsg("Informe o email do admin da barbearia.");

    setLoading(true);

    const res = await fetch("/api/saas/barbershops/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim() || undefined,
        adminEmail: adminEmail.trim(),
        adminName: adminName.trim() || undefined,
      }),
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(getErrorMessage(json) || "Falha ao criar barbearia.");
      setLoading(false);
      return;
    }

    const okJson = json as {
      shop?: { name?: string; slug?: string };
      invited_admin_email?: string;
    };

    setMsg(
      `✅ Barbearia criada: ${okJson.shop?.name ?? name} (slug: ${
        okJson.shop?.slug ?? slug
      }). Convite enviado para ${okJson.invited_admin_email ?? adminEmail}`,
    );

    setName("");
    setSlug("");
    setAdminEmail("");
    setAdminName("");

    await load();
    setLoading(false);
  }

  async function handleDeactivate(shop: Shop) {
    setMsg(null);

    const ok = confirm(
      `Desativar a barbearia "${shop.name}"?\n\nEla vai parar de aparecer publicamente.`,
    );
    if (!ok) return;

    setLoading(true);

    const res = await fetch(`/api/saas/barbershops/${shop.id}/deactivate`, {
      method: "POST",
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(getErrorMessage(json) || "Falha ao desativar.");
      setLoading(false);
      return;
    }

    setMsg(`✅ Barbearia desativada: ${shop.name}`);
    await load();
    setLoading(false);
  }

  async function handleReactivate(shop: Shop) {
    setMsg(null);

    const ok = confirm(`Reativar a barbearia "${shop.name}"?`);
    if (!ok) return;

    setLoading(true);

    const res = await fetch(`/api/saas/barbershops/${shop.id}/reactivate`, {
      method: "POST",
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(getErrorMessage(json) || "Falha ao reativar.");
      setLoading(false);
      return;
    }

    setMsg(`✅ Barbearia reativada: ${shop.name}`);
    await load();
    setLoading(false);
  }

  async function handleDelete(shop: Shop) {
    setMsg(null);

    const typed = prompt(
      `⚠️ EXCLUIR DEFINITIVO\n\nIsso pode falhar se houver agendamentos/serviços/barbeiros ligados.\n\nPara confirmar, digite: DELETE\n\nBarbearia: ${shop.name}`,
    );
    if (typed !== "DELETE") return;

    setLoading(true);

    const res = await fetch(`/api/saas/barbershops/${shop.id}/delete`, {
      method: "POST",
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(getErrorMessage(json) || "Falha ao excluir.");
      setLoading(false);
      return;
    }

    setMsg(`✅ Barbearia excluída: ${shop.name}`);
    await load();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 lg:p-10 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-4 lg:space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-black leading-tight">
            SaaS <span className="text-yellow-400">Barbearias</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            Você (admin da plataforma) cria barbearias e convida o admin do
            cliente.
          </p>
        </header>

        {/* RESUMO FINANCEIRO (tablet-safe) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-zinc-400">Total</div>
            <div className="text-2xl font-black">{stats.total}</div>
            <div className="text-xs text-zinc-500 mt-1">Cadastradas</div>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-zinc-400">Ativas</div>
            <div className="text-2xl font-black">{stats.activeTotal}</div>
            <div className="text-xs text-zinc-500 mt-1">No MRR</div>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-zinc-400">Start</div>
            <div className="text-2xl font-black">{stats.counts.start}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {moneyBRL(PLAN_PRICE.start)}/mês
            </div>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-zinc-400">Pro</div>
            <div className="text-2xl font-black">{stats.counts.pro}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {moneyBRL(PLAN_PRICE.pro)}/mês
            </div>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="text-xs text-zinc-400">MRR estimado</div>
            <div className="text-2xl font-black text-yellow-400">
              {moneyBRL(stats.mrr)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Só ativas</div>
          </div>
        </section>

        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-sm text-zinc-200">
            {msg}
          </div>
        )}

        {/* FORM (tablet-safe: só vira 2 colunas no lg) */}
        <section className="bg-zinc-950 border border-white/10 rounded-2xl p-4 lg:p-6 space-y-4">
          <h2 className="text-lg lg:text-xl font-black">
            Criar nova barbearia
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-400">Nome</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Top Cuts Sete Lagoas"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Slug (opcional)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: top-cuts-sete-lagoas"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Admin (email)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="cliente@barbearia.com"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">
                Admin (nome opcional)
              </label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-3 outline-none"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Ex: João"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-yellow-400 text-black font-black hover:opacity-95 transition disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar barbearia + convidar admin"}
          </button>
        </section>

        {/* LIST */}
        <section className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg lg:text-xl font-black">
              Barbearias cadastradas
            </h2>

            <button
              onClick={load}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-3 rounded-lg bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <div className="p-4 space-y-3">
            {shops.length === 0 && (
              <div className="text-zinc-400">Nenhuma barbearia ainda.</div>
            )}

            {shops.map((s) => (
              <div
                key={s.id}
                className="border border-white/10 rounded-xl p-4 bg-black/30 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-black text-base sm:text-lg flex items-center gap-2 flex-wrap">
                    <span className="min-w-0 break-words">{s.name}</span>

                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        s.is_active
                          ? "border-emerald-500 text-emerald-400"
                          : "border-zinc-600 text-zinc-400"
                      }`}
                    >
                      {s.is_active ? "ATIVA" : "DESATIVADA"}
                    </span>

                    <span className="text-xs px-2 py-1 rounded-full border border-yellow-500/40 text-yellow-300">
                      {planLabel(s.plan)} • {moneyBRL(PLAN_PRICE[s.plan])}/mês
                    </span>
                  </div>

                  <div className="text-zinc-400 text-sm break-words">
                    slug: <span className="text-zinc-300">{s.slug}</span>
                  </div>
                </div>

                {/* Botões: tablet-safe (grid), desktop (flex) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:flex lg:flex-wrap lg:justify-end">
                  <a
                    className="text-center w-full px-4 py-3 rounded-lg bg-emerald-500 text-black font-black"
                    href={`/b/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Landing
                  </a>

                  <a
                    className="text-center w-full px-4 py-3 rounded-lg bg-yellow-400 text-black font-black"
                    href={`/agendar/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Agendar
                  </a>

                  <button
                    className="sm:col-span-1 col-span-2 lg:col-auto w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/15 transition font-black disabled:opacity-50"
                    disabled={loading || !s.is_active}
                    onClick={() => handleDeactivate(s)}
                    title={
                      !s.is_active
                        ? "Já está desativada"
                        : "Desativar barbearia"
                    }
                  >
                    Desativar
                  </button>

                  <button
                    className="sm:col-span-1 col-span-2 lg:col-auto w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/15 transition font-black disabled:opacity-50"
                    disabled={loading || s.is_active}
                    onClick={() => handleReactivate(s)}
                    title={s.is_active ? "Já está ativa" : "Reativar barbearia"}
                  >
                    Reativar
                  </button>

                  <button
                    className="col-span-2 sm:col-span-1 lg:col-auto w-full px-4 py-3 rounded-lg bg-red-600 text-white font-black hover:opacity-90 transition disabled:opacity-50"
                    disabled={loading}
                    onClick={() => handleDelete(s)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="text-xs text-zinc-500">
          * Recomendado: desativar primeiro. Excluir definitivo pode falhar se
          houver registros vinculados (agendamentos, barbeiros, serviços,
          horários etc).
        </div>
      </div>
    </div>
  );
}
