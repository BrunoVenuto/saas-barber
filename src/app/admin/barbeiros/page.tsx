"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

type Barber = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  barbershop_id: string;
  profile_id?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function BarbeirosPage() {
  const supabase = createClient();

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

  // invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);

  const isEditing = useMemo(() => !!editingId, [editingId]);

  const loadAll = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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

  const handleSave = useCallback(async () => {
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
  }, [active, barbershopId, editingId, isEditing, loadAll, name, phone, supabase]);

  const handleDelete = useCallback(
    async (id: string) => {
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
    },
    [editingId, loadAll, supabase]
  );

  function openInviteModal() {
    setInviteName("");
    setInviteEmail("");
    setInvitePhone("");
    setInviteOpen(true);
  }

  const handleInvite = useCallback(async () => {
    setMsg(null);

    const n = inviteName.trim();
    const e = inviteEmail.trim().toLowerCase();
    const p = invitePhone.trim();

    if (!n) {
      setMsg("Informe o nome do barbeiro para convite.");
      return;
    }
    if (!e || !e.includes("@")) {
      setMsg("Informe um email válido para convite.");
      return;
    }

    setInviting(true);

    const res = await fetch("/api/admin/barbers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        email: e,
        phone: p ? onlyDigits(p) : null,
      }),
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg =
        typeof (json as { error?: unknown })?.error === "string"
          ? (json as { error: string }).error
          : "Falha ao convidar.";
      setMsg("Erro ao convidar: " + errMsg);
      setInviting(false);
      return;
    }

    setInviteOpen(false);
    setInviting(false);
    setMsg("✅ Convite enviado! O barbeiro vai receber um email para criar a senha.");
    await loadAll();
  }, [inviteEmail, inviteName, invitePhone, loadAll]);

  if (loading) {
    return <div className="p-8 text-white">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6 text-white">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-yellow-400">Barbeiros</h1>
          <p className="text-zinc-400 mt-1">
            Aqui você cadastra e também pode <span className="text-zinc-200 font-semibold">convidar por email</span>.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openInviteModal}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-black hover:opacity-90"
          >
            ✉️ Convidar barbeiro
          </button>

          <button
            onClick={resetForm}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-black hover:opacity-90"
          >
            + Novo barbeiro
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
          {msg}
        </div>
      )}

      {/* FORM */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">{isEditing ? "Editar barbeiro" : "Cadastrar barbeiro"}</h2>
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
          onClick={() => void handleSave()}
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
              className="bg-zinc-950 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <p className="font-black text-zinc-100">
                  {b.name}{" "}
                  {!b.active && <span className="text-xs text-zinc-400">(inativo)</span>}
                </p>
                <div className="text-zinc-400 text-sm space-x-2">
                  {b.phone ? <span>{b.phone}</span> : <span>sem telefone</span>}
                  <span className="opacity-50">•</span>
                  <span className="opacity-70">{b.profile_id ? "tem login (convidado)" : "sem login"}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(b)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 font-black"
                >
                  Editar
                </button>
                <button
                  onClick={() => void handleDelete(b.id)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:opacity-90 font-black"
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* INVITE MODAL */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-emerald-300">Convidar barbeiro</h3>
              <button
                onClick={() => setInviteOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-400 text-sm">
              O barbeiro vai receber um email para <span className="text-zinc-200 font-semibold">criar a senha</span> e
              acessar a área dele.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-zinc-400">Nome</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Ex: João"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Email</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ex: joao@email.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Telefone (opcional)</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="Ex: (31) 99999-9999"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setInviteOpen(false)}
                className="h-12 px-5 rounded-xl bg-white/10 hover:bg-white/15 transition font-black"
                disabled={inviting}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleInvite()}
                className={cx(
                  "h-12 flex-1 px-5 rounded-xl font-black transition",
                  inviting
                    ? "bg-emerald-500/60 text-black opacity-80"
                    : "bg-emerald-500 text-black hover:scale-[1.01]"
                )}
                disabled={inviting}
              >
                {inviting ? "Enviando..." : "Enviar convite"}
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              Dica: se der erro de env, confirme que <span className="text-zinc-300 font-semibold">NEXT_PUBLIC_APP_URL</span>{" "}
              está definido na Vercel.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
