"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Barber = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  barbershop_id: string;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export default function BarbeirosPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  // form create/edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  const isEditing = useMemo(() => !!editingId, [editingId]);

  // Se veio do onboarding, o onboarding vai mandar:
  // /admin/barbeiros?next=/admin/onboarding?step=4
  const nextUrl = searchParams.get("next");

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const bsId = await getCurrentBarbershopIdBrowser();
    if (!bsId) {
      setMsg("Não foi possível identificar a barbearia do usuário logado (barbershop_id).");
      setLoading(false);
      return;
    }
    setBarbershopId(bsId);

    const { data, error } = await supabase
      .from("barbers")
      .select("id,name,phone,active,barbershop_id")
      .eq("barbershop_id", bsId)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Erro ao carregar barbeiros: " + error.message);
      setBarbers([]);
      setLoading(false);
      return;
    }

    setBarbers((data as Barber[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPhone("");
    setActive(true);
  }

  function startEdit(b: Barber) {
    setEditingId(b.id);
    setName(b.name || "");
    setPhone(b.phone || "");
    setActive(!!b.active);
  }

  async function handleSave() {
    if (!barbershopId) return;

    const n = name.trim();
    if (!n) {
      setMsg("Informe o nome do barbeiro.");
      return;
    }

    setSaving(true);
    setMsg(null);

    const payload = {
      name: n,
      phone: phone.trim() ? onlyDigits(phone) : null,
      active: !!active,
      barbershop_id: barbershopId,
    };

    if (!isEditing) {
      const { error } = await supabase.from("barbers").insert(payload);
      if (error) {
        setMsg("Erro ao criar barbeiro: " + error.message);
        setSaving(false);
        return;
      }

      setMsg("✅ Barbeiro criado!");
      resetForm();
      await loadAll();
      setSaving(false);

      // ✅ UX: se veio do onboarding, após salvar volta direto pro próximo passo
      if (nextUrl) router.push(nextUrl);

      return;
    }

    const { error } = await supabase.from("barbers").update(payload).eq("id", editingId);

    if (error) {
      setMsg("Erro ao salvar barbeiro: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Barbeiro atualizado!");
    resetForm();
    await loadAll();
    setSaving(false);

    // ✅ UX: se veio do onboarding, após salvar volta direto pro próximo passo
    if (nextUrl) router.push(nextUrl);
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja remover este barbeiro?")) return;

    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("barbers").delete().eq("id", id);

    if (error) {
      setMsg("Erro ao remover barbeiro: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Barbeiro removido!");
    if (editingId === id) resetForm();
    await loadAll();
    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-white">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-yellow-400">Barbeiros</h1>
          <p className="text-zinc-400 mt-1">
            Estes dados salvam em{" "}
            <span className="text-zinc-200 font-semibold">public.barbers</span>
          </p>
        </div>

        <button
          onClick={() => resetForm()}
          className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-black hover:opacity-90"
        >
          + Novo barbeiro
        </button>
      </div>

      {msg && (
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
          {msg}
        </div>
      )}

      {/* FORM */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">
            {isEditing ? "Editar barbeiro" : "Cadastrar barbeiro"}
          </h2>
          {isEditing && (
            <button
              onClick={resetForm}
              className="text-sm text-zinc-300 hover:text-white underline"
            >
              cancelar edição
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-zinc-400">Nome</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: José"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Telefone (opcional)</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: (31) 99999-9999"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <label htmlFor="active" className="text-sm text-zinc-300">
              Ativo (aparece para o cliente)
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.01] transition disabled:opacity-50"
        >
          {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar barbeiro"}
        </button>
      </div>

      {/* LISTA */}
      <div className="space-y-3">
        {barbers.length === 0 ? (
          <p className="text-zinc-400">Nenhum barbeiro cadastrado.</p>
        ) : (
          barbers.map((b) => (
            <div
              key={b.id}
              className="bg-zinc-950 border border-white/10 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-black text-zinc-100">
                  {b.name}{" "}
                  {!b.active && (
                    <span className="text-xs text-zinc-400">(inativo)</span>
                  )}
                </p>
                {b.phone && <p className="text-zinc-400 text-sm">{b.phone}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(b)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 font-black"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:opacity-90 font-black"
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
