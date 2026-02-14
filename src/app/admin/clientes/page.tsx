"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: string;
  barbershop_id: string | null;
  name?: string | null;
};

type AppointmentRow = {
  client_name: string | null;
  client_phone: string | null;
  created_at: string | null;
};

type ClientItem = {
  key: string; // phone/name unique key
  name: string;
  phone: string;
  last_seen_at: string | null;
  total_appointments: number;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function formatPhoneBR(raw: string) {
  const d = onlyDigits(raw);
  if (!d) return "-";
  // simples (sem mascaras complexas): 11 dígitos -> (DD) 9xxxx-xxxx
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export default function AdminClientesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<AppointmentRow[]>([]);

  const clients = useMemo<ClientItem[]>(() => {
    // Dedup por telefone (prioridade), senão por nome
    const map = new Map<string, ClientItem>();

    for (const r of rows) {
      const name = (r.client_name || "").trim() || "—";
      const phoneDigits = onlyDigits(r.client_phone || "");
      const phone = phoneDigits || "";
      const key = phone ? `p:${phone}` : `n:${name.toLowerCase()}`;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          name,
          phone,
          last_seen_at: r.created_at ?? null,
          total_appointments: 1,
        });
      } else {
        prev.total_appointments += 1;
        const prevTime = prev.last_seen_at ? new Date(prev.last_seen_at).getTime() : 0;
        const nowTime = r.created_at ? new Date(r.created_at).getTime() : 0;
        if (nowTime > prevTime) prev.last_seen_at = r.created_at ?? prev.last_seen_at;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return tb - ta;
    });
  }, [rows]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      setMsg(userErr.message);
      setLoading(false);
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    // 2) profile
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id, name")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      setMsg("Perfil não encontrado.");
      setLoading(false);
      return;
    }

    setProfile(prof as Profile);

    if (prof.role !== "admin") {
      setMsg("Acesso negado: apenas admin.");
      setLoading(false);
      return;
    }

    if (!prof.barbershop_id) {
      setMsg("Este admin é da plataforma (barbershop_id NULL).");
      setLoading(false);
      return;
    }

    // 3) clientes = vem de appointments
    const { data, error } = await supabase
      .from("appointments")
      .select("client_name, client_phone, created_at")
      .eq("barbershop_id", prof.barbershop_id)
      .not("client_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      setMsg("Erro ao buscar clientes: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(Array.isArray(data) ? (data as AppointmentRow[]) : []);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black">
              👥 Clientes <span className="text-yellow-400">do seu negócio</span>
            </h1>
            <p className="text-zinc-400 mt-2">
              Lista gerada automaticamente pelos agendamentos (appointments).
            </p>
          </div>

          <button
            onClick={loadClients}
            disabled={loading}
            className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition font-black disabled:opacity-50"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </header>

        {msg && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl p-4">
            {msg}
          </div>
        )}

        <section className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black">
              Total: <span className="text-yellow-400">{clients.length}</span>
            </h2>
            <div className="text-xs text-zinc-500">
              Logado:{" "}
              <span className="text-zinc-300 font-semibold">
                {profile?.name || profile?.id || "—"}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-3">
            {loading && <div className="text-zinc-400">Carregando...</div>}

            {!loading && clients.length === 0 && (
              <div className="text-zinc-400">
                Nenhum cliente encontrado ainda. Faça um agendamento para aparecer aqui.
              </div>
            )}

            {clients.map((c) => (
              <div
                key={c.key}
                className="border border-white/10 rounded-xl p-4 bg-black/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-black text-lg truncate">{c.name}</p>
                  <p className="text-sm text-zinc-400">
                    Tel:{" "}
                    <span className="text-zinc-200 font-semibold">
                      {c.phone ? formatPhoneBR(c.phone) : "-"}
                    </span>{" "}
                    • Agendamentos:{" "}
                    <span className="text-zinc-200 font-semibold">{c.total_appointments}</span>
                  </p>
                </div>

                <div className="text-xs text-zinc-500">
                  Última visita:{" "}
                  <span className="text-zinc-300 font-semibold">
                    {c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
