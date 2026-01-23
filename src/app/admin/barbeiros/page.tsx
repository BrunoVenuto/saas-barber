"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Barber = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  barbershop_id: string;
  profile_id: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export default function BarbeirosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  // form create/edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  const isEditing = useMemo(() => !!editingId, [editingId]);

  const amIAlreadyBarber = useMemo(() => {
    if (!myProfileId) return false;
    return barbers.some((b) => b.profile_id === myProfileId);
  }, [barbers, myProfileId]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMsg("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    setMyProfileId(user.id);

    const bsId = await getCurrentBarbershopIdBrowser();
    if (!bsId) {
      setMsg("Não foi possível identificar a barbearia.");
      setLoading(false);
      return;
    }
    setBarbershopId(bsId);

    const { data, error } = await supabase
      .from("barbers")
      .select("id,name,phone,active,barbershop_id,profile_id")
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

  async function handleBecomeBarber() {
    if (!barbershopId || !myProfileId) return;

    setSaving(true);
    setMsg(null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", myProfileId)
      .single<{ name: string | null }>();

    const { error } = await supabase.from("barbers").insert({
      barbershop_id: barbershopId,
      profile_id: myProfileId,
      name: profile?.name || "Administrador",
      active: true,
    });

    if (error) {
      setMsg("Erro ao se tornar barbeiro: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Você agora é um barbeiro também!");
    await loadAll();
    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-white">Carregando...</div>;
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 text-white">
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-yellow-400">Barbeiros</h1>
        <p className="text-zinc-400">Gerencie quem atende clientes na sua barbearia.</p>
      </div>

      {/* BOTÃO DONO VIRAR BARBEIRO */}
      {!amIAlreadyBarber && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="font-bold text-emerald-400">Você também atende clientes?</p>
            <p className="text-sm text-zinc-300">
              Clique no botão para aparecer como barbeiro e definir seus horários.
            </p>
          </div>

          <button
            onClick={handleBecomeBarber}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-black disabled:opacity-50"
          >
            {saving ? "Ativando..." : "Eu também atendo"}
          </button>
        </div>
      )}

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
            <button onClick={resetForm} className="text-sm text-zinc-300 underline">
              cancelar edição
            </button>
          )}
        </div>

        <div className="grid gap-4">
          <div>
            <label className="text-sm text-zinc-400">Nome</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Telefone (opcional)</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
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
          className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
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
                  {!b.active && <span className="text-xs text-zinc-400">(inativo)</span>}
                  {b.profile_id === myProfileId && (
                    <span className="ml-2 text-xs text-emerald-400">(você)</span>
                  )}
                </p>
                {b.phone && <p className="text-zinc-400 text-sm">{b.phone}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(b)}
                  className="px-4 py-2 rounded-lg bg-white/10 font-black"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="px-4 py-2 rounded-lg bg-red-600 font-black"
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
