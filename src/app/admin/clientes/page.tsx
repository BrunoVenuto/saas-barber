"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Client = {
  id: string;
  name: string;
  phone: string | null;
};

export default function ClientesPage() {
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function loadClients() {
    setLoading(true);

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, phone")
      .eq("barbershop_id", barbershopId)
      .eq("role", "client")
      .order("name");

    if (error) {
      alert("Erro ao buscar clientes: " + error.message);
    } else {
      setClients(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  function openNewModal() {
    setEditingClient(null);
    setName("");
    setPhone("");
    setModalOpen(true);
  }

  function openEditModal(client: Client) {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) return;

    if (editingClient) {
      // update
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          phone,
        })
        .eq("id", editingClient.id);

      if (error) {
        alert("Erro ao atualizar: " + error.message);
        return;
      }
    } else {
      // insert
      const { error } = await supabase.from("profiles").insert({
        name,
        phone,
        role: "client",
        barbershop_id: barbershopId,
      });

      if (error) {
        alert("Erro ao criar cliente: " + error.message);
        return;
      }
    }

    setModalOpen(false);
    await loadClients();
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Deseja remover ${client.name}?`)) return;

    const { error } = await supabase.from("profiles").delete().eq("id", client.id);

    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }

    await loadClients();
  }

  if (loading) {
    return <div className="p-8">Carregando clientes...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-yellow-400">Clientes</h1>

        <button
          onClick={openNewModal}
          className="bg-yellow-400 text-black font-bold px-4 py-2 rounded"
        >
          + Novo cliente
        </button>
      </div>

      <div className="bg-zinc-900 rounded overflow-hidden">
        {clients.length === 0 && (
          <p className="p-4 opacity-70">Nenhum cliente cadastrado.</p>
        )}

        {clients.map((c) => (
          <div
            key={c.id}
            className="flex justify-between items-center border-b border-white/10 p-4"
          >
            <div>
              <p className="font-bold">{c.name}</p>
              {c.phone && <p className="text-sm opacity-70">{c.phone}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEditModal(c)}
                className="px-3 py-1 bg-zinc-700 rounded"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="px-3 py-1 bg-red-600 rounded"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-yellow-400">
              {editingClient ? "Editar cliente" : "Novo cliente"}
            </h2>

            <div>
              <label className="block mb-1">Nome</label>
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

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-zinc-700 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-yellow-400 text-black font-bold rounded"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
