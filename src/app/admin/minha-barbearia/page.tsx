"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: "admin" | "barber" | "client" | string;
  barbershop_id: string | null;
  name?: string | null;
};

type Barbershop = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  instagram: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function normalizeInstagram(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

// ✅ deixa o slug sempre limpo (sem acento, sem espaço)
function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export default function MinhaBarbeariaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Barbershop | null>(null);

  // form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [instagram, setInstagram] = useState("");

  // ✅ preview usa o slug salvo no banco (shop.slug), para não confundir antes de salvar
  const landingUrl = useMemo(() => {
    if (!shop?.slug) return null;
    return `/b/${shop.slug}`;
  }, [shop?.slug]);

  const bookingUrl = useMemo(() => {
    if (!shop?.slug) return null;
    return `/agendar/${shop.slug}`;
  }, [shop?.slug]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    // 1) user
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
      setMsg("Perfil não encontrado no profiles.");
      setLoading(false);
      return;
    }

    setProfile(prof as Profile);

    // ✅ somente admin de barbearia (barbershop_id NOT NULL)
    if (prof.role !== "admin") {
      setMsg("Acesso negado: apenas administradores podem acessar esta página.");
      setLoading(false);
      return;
    }

    if (!prof.barbershop_id) {
      setMsg(
        "Você é admin da plataforma (barbershop_id = NULL). Esta página é apenas para admin de uma barbearia."
      );
      setLoading(false);
      return;
    }

    // 3) barbershop
    const { data: bs, error: bsErr } = await supabase
      .from("barbershops")
      .select("id,name,slug,phone,whatsapp,address,city,instagram")
      .eq("id", prof.barbershop_id)
      .single();

    if (bsErr || !bs) {
      setMsg(
        "Não consegui carregar sua barbearia. Verifique se a tabela barbershops tem as colunas (phone, whatsapp, address, city, instagram)."
      );
      setLoading(false);
      return;
    }

    const s = bs as Barbershop;
    setShop(s);

    // preencher form
    setName(s.name || "");
    setSlug(s.slug || "");
    setPhone(s.phone || "");
    setWhatsapp(s.whatsapp || "");
    setAddress(s.address || "");
    setCity(s.city || "");
    setInstagram(s.instagram || "");

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ se o usuário digitar nome e o slug estiver vazio, sugerimos automaticamente
  useEffect(() => {
    if (!shop) return;
    if (slug.trim()) return;
    const suggested = slugify(name);
    if (suggested) setSlug(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function handleSave() {
    if (!shop) return;
    setSaving(true);
    setMsg(null);

    const slugClean = slugify(slug.trim() || name.trim() || shop.slug);

    if (!slugClean) {
      setMsg("Slug inválido. Informe um slug válido.");
      setSaving(false);
      return;
    }

    const waDigits = onlyDigits(whatsapp);

    const payload = {
      name: name.trim() || shop.name,
      slug: slugClean,
      phone: phone.trim() || null,
      whatsapp: waDigits ? waDigits : null,
      address: address.trim() || null,
      city: city.trim() || null,
      instagram: instagram.trim() ? normalizeInstagram(instagram) : null,
    };

    // ✅ dica: se der erro aqui, quase sempre é RLS/policy bloqueando UPDATE
    const { error } = await supabase.from("barbershops").update(payload).eq("id", shop.id);

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Dados atualizados com sucesso!");
    await loadAll();
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black">
              Minha <span className="text-yellow-400">barbearia</span>
            </h1>
            <p className="text-zinc-400 mt-2">
              Edite os dados que aparecem na landing{" "}
              <span className="text-zinc-200 font-semibold">/b/[slug]</span>
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {landingUrl && (
              <Link
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-black"
                href={landingUrl}
                target="_blank"
              >
                Ver landing
              </Link>
            )}
            {bookingUrl && (
              <Link
                className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-black"
                href={bookingUrl}
                target="_blank"
              >
                Ver agendamento
              </Link>
            )}
            <button
              onClick={loadAll}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition font-black"
              disabled={loading || saving}
            >
              Atualizar
            </button>
          </div>
        </header>

        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-6 text-zinc-300">
            Carregando...
          </div>
        ) : !shop ? (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-6 text-zinc-300">
            Nenhuma barbearia carregada.
          </div>
        ) : (
          <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400">Nome</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Barbearia do Zé"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Slug</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="Ex: barbearia-do-ze"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Usado em <span className="text-zinc-300 font-semibold">/b/{shop.slug}</span> e{" "}
                  <span className="text-zinc-300 font-semibold">/agendar/{shop.slug}</span>. (Após salvar, o slug muda lá também.)
                </p>
              </div>

              <div>
                <label className="text-sm text-zinc-400">Telefone</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (31) 99999-9999"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">WhatsApp</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: 31999999999"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Salve só números (DDD + número). A landing monta o link wa.me/55...
                </p>
              </div>

              <div>
                <label className="text-sm text-zinc-400">Endereço</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Centro, 123"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Cidade</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Sete Lagoas - MG"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-zinc-400">Instagram</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Ex: @barbeariadoze"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.01] transition disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar dados da landing"}
              </button>

              <Link
                href="/admin/agenda"
                className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition font-black flex items-center"
              >
                Voltar para agenda
              </Link>
            </div>

            <div className="pt-4 text-xs text-zinc-500">
              Logado como:{" "}
              <span className="text-zinc-300 font-semibold">
                {profile?.name || profile?.id}
              </span>{" "}
              • barbershop_id:{" "}
              <span className="text-zinc-300 font-semibold">
                {profile?.barbershop_id}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
