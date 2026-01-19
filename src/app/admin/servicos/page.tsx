"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

export default function ServicosPage() {
  const supabase = createClient();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");

  async function loadServices() {
    setLoading(true);

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("barbershop_id", barbershopId)
      .order("name");

    if (error) {
      alert("Erro ao buscar serviços: " + error.message);
    } else {
      setServices(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadServices();
  }, []);

  function openNewModal() {
    setEditingService(null);
    setName("");
    setPrice("");
    setDuration("");
    setModalOpen(true);
  }

  function openEditModal(service: Service) {
    setEditingService(service);
    setName(service.name);
    setPrice(String(service.price));
    setDuration(String(service.duration_minutes));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !price || !duration) {
      alert("Preencha todos os campos");
      return;
    }

    const barbershopId = await getCurrentBarbershopIdBrowser();
    if (!barbershopId) return;

    const payload = {
      name,
      price: Number(price),
      duration_minutes: Number(duration),
      barbershop_id: barbershopId,
    };

    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", editingService.id);

      if (error) {
        alert("Erro ao atualizar: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("services").insert(payload);

      if (error) {
        alert("Erro ao criar serviço: " + error.message);
        return;
      }
    }

    setModalOpen(false);
    await loadServices();
  }

  async function handleDelete(service: Service) {
    if (!confirm(`Deseja remover o serviço "${service.name}"?`)) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", service.id);

    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }

    await loadServices();
  }

  if (loading) {
    return <div className="p-8">Carregando serviços...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-yellow-400">Serviços</h1>

        <button
          onClick={openNewModal}
          className="bg-yellow-400 text-black font-bold px-4 py-2 rounded"
        >
          + Novo serviço
        </button>
      </div>

      <div className="bg-zinc-900 rounded overflow-hidden">
        {services.length === 0 && (
          <p className="p-4 opacity-70">Nenhum serviço cadastrado.</p>
        )}

        {services.map((s) => (
          <div
            key={s.id}
            className="flex justify-between items-center border-b border-white/10 p-4"
          >
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm opacity-70">
                R$ {s.price.toFixed(2)} • {s.duration_minutes} min
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEditModal(s)}
                className="px-3 py-1 bg-zinc-700 rounded"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(s)}
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
              {editingService ? "Editar serviço" : "Novo serviço"}
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
              <label className="block mb-1">Preço (R$)</label>
              <input
                type="number"
                className="w-full bg-black border border-white/10 p-2 rounded"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1">Duração (minutos)</label>
              <input
                type="number"
                className="w-full bg-black border border-white/10 p-2 rounded"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
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
