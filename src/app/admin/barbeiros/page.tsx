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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

type InviteResponseOk = {
  ok: true;
  invited_email: string;
  barber_user_id: string;
  barbershop_id: string;
  redirectTo: string;
};

type InviteResponseErr = {
  error: string;
};

type InviteResponse = InviteResponseOk | InviteResponseErr;

export default function BarbeirosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  // modal convite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");

  // form create/edit manual (fallback)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  const isEditing = useMemo(() => !!editingId, [editingId]);

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

  function openInvite() {
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("");
    setInviteOpen(true);
    setMsg(null);
  }

  async function handleInviteSubmit() {
    setMsg(null);

    const email = inviteEmail.trim().toLowerCase();
    const nm = inviteName.trim();

    if (!email) {
      setMsg("Informe o email do barbeiro.");
      return;
    }
    if (!nm) {
      setMsg("Informe o nome do barbeiro.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/barbers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: nm,
          phone: invitePhone.trim() ? onlyDigits(invitePhone) : null,
        }),
      });

      const raw: unknown = await res.json().catch(() => null);

      // ✅ sem any: valida shape mínimo
      let parsed: InviteResponse = { error: "Resposta inválida da API." };
      if (isObject(raw)) {
        const err = getString(raw, "error");
        const ok = raw["ok"] === true;

        if (err) {
          parsed = { error: err };
        } else if (ok) {
          const invited_email = getString(raw, "invited_email") || email;
          const barber_user_id = getString(raw, "barber_user_id") || "";
          const barbershop_id = getString(raw, "barbershop_id") || "";
          const redirectTo = getString(raw, "redirectTo") || "";

          parsed = {
            ok: true,
            invited_email,
            barber_user_id,
            barbershop_id,
            redirectTo,
          };
        }
      }

      if (!res.ok) {
        setMsg("Erro ao convidar: " + ("error" in parsed ? parsed.error : "Falha desconhecida."));
        setSaving(false);
        return;
      }

      if (!("ok" in parsed) || parsed.ok !== true) {
        setMsg("Erro ao convidar: " + ("error" in parsed ? parsed.error : "Falha desconhecida."));
        setSaving(false);
        return;
      }

      setMsg(`✅ Convite enviado para ${parsed.invited_email}. Ele vai criar a senha pelo link do email.`);
      setInviteOpen(false);
      await loadAll();
      setSaving(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado.";
      setMsg("Erro ao convidar: " + message);
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-white">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6 text-white">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-yellow-400">Barbeiros</h1>
          <p className="text-zinc-400 mt-1">
            Convide barbeiros por email (recomendado) ou cadastre manualmente.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openInvite}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-black hover:opacity-90"
          >
            ✉️ Convidar barbeiro
          </button>

          <button
            onClick={() => resetForm()}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-black hover:opacity-90"
          >
            + Novo (manual)
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
          {msg}
        </div>
      )}

      {/* FORM MANUAL */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">
            {isEditing ? "Editar barbeiro" : "Cadastrar barbeiro (manual)"}
          </h2>
          {isEditing && (
            <button onClick={resetForm} className="text-sm text-zinc-300 hover:text-white underline">
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
              className="bg-zinc-950 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div>
                <p className="font-black text-zinc-100">
                  {b.name} {!b.active && <span className="text-xs text-zinc-400">(inativo)</span>}
                </p>
                <p className="text-zinc-400 text-sm">
                  {b.phone ? b.phone : "sem telefone"} •{" "}
                  {b.profile_id ? "tem login (convite)" : "manual (sem login)"}
                </p>
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

      {/* MODAL CONVITE */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-black text-emerald-300">Convidar barbeiro</h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-zinc-400">
              O barbeiro recebe um email, cria a senha e entra direto na área dele.
            </p>

            <div>
              <label className="text-sm text-zinc-400">Email</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="ex: barbeiro@gmail.com"
                autoComplete="email"
              />
            </div>

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
              <label className="text-sm text-zinc-400">Telefone (opcional)</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="Ex: (31) 99999-9999"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 font-black"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50"
              >
                {saving ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
