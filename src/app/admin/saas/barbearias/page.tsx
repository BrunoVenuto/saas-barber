"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Shop = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

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
      .select("id,name,slug,is_active")
      .order("name", { ascending: true });

    if (error) {
      setMsg(error.message);
      setShops([]);
      setLoading(false);
      return;
    }

    setShops((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setMsg(null);

    if (!name.trim()) return setMsg("Informe o nome da barbearia.");
    if (!adminEmail.trim()) return setMsg("Informe o email do admin da barbearia.");

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

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(json?.error || "Falha ao criar barbearia.");
      setLoading(false);
      return;
    }

    setMsg(
      `✅ Barbearia criada: ${json.shop.name} (slug: ${json.shop.slug}). Convite enviado para ${json.invited_admin_email || adminEmail}`
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

    const ok = confirm(`Desativar a barbearia "${shop.name}"?\n\nEla vai parar de aparecer publicamente.`);
    if (!ok) return;

    setLoading(true);

    const res = await fetch(`/api/saas/barbershops/${shop.id}/deactivate`, {
      method: "POST",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(json?.error || "Falha ao desativar.");
      setLoading(false);
      return;
    }

    setMsg(`✅ Barbearia desativada: ${shop.name}`);
    await load();
    setLoading(false);
  }

  async function handleDelete(shop: Shop) {
    setMsg(null);

    const typed = prompt(
      `⚠️ EXCLUIR DEFINITIVO\n\nIsso pode falhar se houver agendamentos/serviços/barbeiros ligados.\n\nPara confirmar, digite: DELETE\n\nBarbearia: ${shop.name}`
    );

    if (typed !== "DELETE") return;

    setLoading(true);

    const res = await fetch(`/api/saas/barbershops/${shop.id}/delete`, {
      method: "POST",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setMsg(json?.error || "Falha ao excluir.");
      setLoading(false);
      return;
    }

    setMsg(`✅ Barbearia excluída: ${shop.name}`);
    await load();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl md:text-5xl font-black">
            SaaS <span className="text-yellow-400">Barbearias</span>
          </h1>
          <p className="text-zinc-400 mt-2">
            Você (admin da plataforma) cria barbearias e convida o admin do cliente.
          </p>
        </header>

        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
            {msg}
          </div>
        )}

        <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-black">Criar nova barbearia</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-400">Nome</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Top Cuts Sete Lagoas"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Slug (opcional)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: top-cuts-sete-lagoas"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Admin (email)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="cliente@barbearia.com"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Admin (nome opcional)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Ex: João"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.01] transition disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar barbearia + convidar admin"}
          </button>
        </section>

        <section className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-black">Barbearias cadastradas</h2>

            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
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
                className="border border-white/10 rounded-xl p-4 bg-black/30 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-black text-lg flex items-center gap-2">
                    {s.name}
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        s.is_active
                          ? "border-emerald-500 text-emerald-400"
                          : "border-zinc-600 text-zinc-400"
                      }`}
                    >
                      {s.is_active ? "ATIVA" : "DESATIVADA"}
                    </span>
                  </div>
                  <div className="text-zinc-400 text-sm">slug: {s.slug}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-black"
                    href={`/b/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Landing
                  </a>

                  <a
                    className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-black"
                    href={`/agendar/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Agendar
                  </a>

                  <button
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition font-black"
                    disabled={loading || !s.is_active}
                    onClick={() => handleDeactivate(s)}
                    title={!s.is_active ? "Já está desativada" : "Desativar barbearia"}
                  >
                    Desativar
                  </button>

                  <button
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-black hover:opacity-90 transition"
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
          * Recomendado: desativar primeiro. Excluir definitivo pode falhar se houver registros vinculados
          (agendamentos, barbeiros, serviços, horários etc).
        </div>
      </div>
    </div>
  );
}
