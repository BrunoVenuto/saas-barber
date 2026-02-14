"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Barbershop = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export default function MinhaBarbeariaPage() {
  const supabase = createClient();

  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  async function loadBarbershop() {
    setLoading(true);

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("barbershops")
      .select("id, name, phone, address")
      .eq("id", barbershopId)
      .single();

    if (error) {
      alert("Erro ao carregar barbearia: " + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      const shop = data as Barbershop;
      setBarbershop(shop);
      setName(shop.name ?? "");
      setPhone(shop.phone ?? "");
      setAddress(shop.address ?? "");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBarbershop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!barbershop) return;

    if (!name.trim()) {
      alert("O nome da barbearia é obrigatório.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("barbershops")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", barbershop.id);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Dados atualizados com sucesso!");
  }

  if (loading) {
    return <div className="p-8">Carregando dados...</div>;
  }

  if (!barbershop) {
    return (
      <div className="p-8 text-red-400">
        Nenhuma barbearia vinculada ao seu usuário.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">Minha Barbearia</h1>

      <div className="bg-zinc-900 rounded p-6 space-y-4 max-w-2xl">
        <div>
          <label className="block mb-1">Nome da barbearia</label>
          <input
            className="w-full bg-black border border-white/10 p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Telefone</label>
          <input
            className="w-full bg-black border border-white/10 p-2 rounded"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1">Endereço</label>
          <input
            className="w-full bg-black border border-white/10 p-2 rounded"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-400 text-black font-bold px-6 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
