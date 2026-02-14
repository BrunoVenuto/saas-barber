"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: string;
  barbershop_id: string | null;
};

type Shop = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  instagram: string | null;
  onboarded_at: string | null;
  onboarding_step: number | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function normalizeInstagram(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export default function AdminOnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);

  // form step 1
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");

  const step = useMemo(() => shop?.onboarding_step ?? 1, [shop?.onboarding_step]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, barbershop_id")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      setMsg("Perfil não encontrado.");
      setLoading(false);
      return;
    }

    if (prof.role !== "admin" || !prof.barbershop_id) {
      setMsg("Acesso negado.");
      setLoading(false);
      return;
    }

    setProfile(prof as Profile);

    const { data: s, error: shopErr } = await supabase
      .from("barbershops")
      .select("id,name,slug,whatsapp,city,address,instagram,onboarded_at,onboarding_step")
      .eq("id", prof.barbershop_id)
      .single();

    if (shopErr || !s) {
      setMsg("Não consegui carregar sua barbearia.");
      setLoading(false);
      return;
    }

    const typed = s as Shop;

    // se já onboarded, manda pro dashboard
    if (typed.onboarded_at) {
      router.replace("/admin/dashboard");
      return;
    }

    setShop(typed);

    setName(typed.name ?? "");
    setSlug(typed.slug ?? "");
    setWhatsapp(typed.whatsapp ?? "");
    setCity(typed.city ?? "");
    setAddress(typed.address ?? "");
    setInstagram(typed.instagram ?? "");

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // sugestão automática de slug quando estiver vazio
  useEffect(() => {
    if (!shop) return;
    if (slug.trim()) return;
    const s = slugify(name);
    if (s) setSlug(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, shop?.id]);

  const saveStep = useCallback(
    async (nextStep: number) => {
      if (!shop) return;

      setSaving(true);
      setMsg(null);

      const payload: Partial<Shop> = {};

      // Step 1 salva dados base
      if (step === 1) {
        const slugClean = slugify(slug || name || shop.slug);

        if (!name.trim()) {
          setMsg("Informe o nome da barbearia.");
          setSaving(false);
          return;
        }
        if (!slugClean) {
          setMsg("Slug inválido.");
          setSaving(false);
          return;
        }

        payload.name = name.trim();
        payload.slug = slugClean;
        payload.whatsapp = onlyDigits(whatsapp) || null;
        payload.city = city.trim() || null;
        payload.address = address.trim() || null;
        payload.instagram = instagram.trim() ? normalizeInstagram(instagram) : null;
      }

      payload.onboarding_step = nextStep;

      const { error } = await supabase.from("barbershops").update(payload).eq("id", shop.id);

      if (error) {
        setMsg("Erro ao salvar: " + error.message);
        setSaving(false);
        return;
      }

      // ✅ UX: avança imediatamente sem depender do "voltar" do navegador
      setShop((prev) => (prev ? { ...prev, ...payload } as Shop : prev));

      // garante que o header/guard não fique com estado antigo
      router.replace("/admin/onboarding");
      router.refresh();

      setSaving(false);
    },
    [
      name,
      slug,
      whatsapp,
      city,
      address,
      instagram,
      shop,
      step,
      supabase,
      router,
    ]
  );

  const finishOnboarding = useCallback(async () => {
    if (!shop) return;

    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("barbershops")
      .update({ onboarded_at: new Date().toISOString(), onboarding_step: 4 })
      .eq("id", shop.id);

    if (error) {
      setMsg("Erro ao finalizar: " + error.message);
      setSaving(false);
      return;
    }

    router.replace("/admin/dashboard");
  }, [router, shop, supabase]);

  // ✅ Checagens automáticas p/ "avançar sem ficar preso"
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [barbersCount, setBarbersCount] = useState<number | null>(null);
  const [hoursCount, setHoursCount] = useState<number | null>(null);

  const refreshCounts = useCallback(async () => {
    if (!shop?.id) return;

    // services
    const s = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", shop.id);

    // barbers
    const b = await supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", shop.id);

    // working_hours
    const w = await supabase
      .from("working_hours")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", shop.id);

    setServicesCount(typeof s.count === "number" ? s.count : 0);
    setBarbersCount(typeof b.count === "number" ? b.count : 0);
    setHoursCount(typeof w.count === "number" ? w.count : 0);
  }, [shop?.id, supabase]);

  useEffect(() => {
    if (!shop?.id) return;
    refreshCounts();
  }, [refreshCounts, shop?.id, step]);

  // auto-advance opcional: se já cumpriu o requisito, libera botão "Continuar"
  const step2Ready = (servicesCount ?? 0) > 0;
  const step3Ready = (barbersCount ?? 0) > 0;
  const step4Ready = (hoursCount ?? 0) > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando onboarding...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-4xl font-black">
            Configurar <span className="text-yellow-400">sua barbearia</span>
          </h1>
          <p className="text-zinc-400 mt-2">
            Passo {step} de 4 • Termine para liberar o painel.
          </p>
        </header>

        {msg && (
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-zinc-200">
            {msg}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg sm:text-xl font-black">1) Dados principais</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm text-zinc-400">Nome</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Barbearia do Luiz"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-zinc-400">Slug</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="Ex: barbearia-do-luiz"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  URL da landing:{" "}
                  <span className="text-zinc-200 font-semibold">/b/{slugify(slug || name)}</span>
                </p>
              </div>

              <div>
                <label className="text-sm text-zinc-400">WhatsApp</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: 31999999999"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Cidade</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Belo Horizonte - MG"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-zinc-400">Endereço</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Principal, 123"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-zinc-400">Instagram</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Ex: @barbeariadoluiz"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <button
                onClick={() => saveStep(2)}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar e continuar"}
              </button>
            </div>
          </section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg sm:text-xl font-black">2) Serviços</h2>
            <p className="text-zinc-400">
              Crie pelo menos <span className="text-zinc-200 font-semibold">1 serviço</span>.
            </p>

            <div className="text-sm text-zinc-300">
              Status:{" "}
              <span className={step2Ready ? "text-emerald-300 font-bold" : "text-yellow-300 font-bold"}>
                {servicesCount === null ? "checando..." : step2Ready ? "OK" : "pendente"}
              </span>
              {typeof servicesCount === "number" && (
                <span className="text-zinc-500"> • serviços: {servicesCount}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin/servicos")}
                className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition font-black"
              >
                Ir para Serviços
              </button>

              <button
                onClick={async () => {
                  await refreshCounts();
                  if (!((servicesCount ?? 0) > 0)) {
                    setMsg("Crie pelo menos 1 serviço para continuar.");
                    return;
                  }
                  await saveStep(3);
                }}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Continuar → Passo 3"}
              </button>
            </div>
          </section>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg sm:text-xl font-black">3) Equipe</h2>
            <p className="text-zinc-400">
              Cadastre pelo menos <span className="text-zinc-200 font-semibold">1 barbeiro</span>.
            </p>

            <div className="text-sm text-zinc-300">
              Status:{" "}
              <span className={step3Ready ? "text-emerald-300 font-bold" : "text-yellow-300 font-bold"}>
                {barbersCount === null ? "checando..." : step3Ready ? "OK" : "pendente"}
              </span>
              {typeof barbersCount === "number" && (
                <span className="text-zinc-500"> • barbeiros: {barbersCount}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin/barbeiros")}
                className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition font-black"
              >
                Ir para Barbeiros
              </button>

              <button
                onClick={async () => {
                  await refreshCounts();
                  if (!((barbersCount ?? 0) > 0)) {
                    setMsg("Cadastre pelo menos 1 barbeiro para continuar.");
                    return;
                  }
                  await saveStep(4);
                }}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-yellow-400 text-black font-black disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Continuar → Passo 4"}
              </button>
            </div>
          </section>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <section className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg sm:text-xl font-black">4) Horários</h2>
            <p className="text-zinc-400">
              Configure os horários para permitir agendamentos.
            </p>

            <div className="text-sm text-zinc-300">
              Status:{" "}
              <span className={step4Ready ? "text-emerald-300 font-bold" : "text-yellow-300 font-bold"}>
                {hoursCount === null ? "checando..." : step4Ready ? "OK" : "pendente"}
              </span>
              {typeof hoursCount === "number" && (
                <span className="text-zinc-500"> • horários: {hoursCount}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin/horarios")}
                className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition font-black"
              >
                Ir para Horários
              </button>

              <button
                onClick={async () => {
                  await refreshCounts();
                  if (!((hoursCount ?? 0) > 0)) {
                    setMsg("Configure pelo menos 1 horário para finalizar.");
                    return;
                  }
                  await finishOnboarding();
                }}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50"
              >
                {saving ? "Finalizando..." : "Finalizar onboarding ✅"}
              </button>
            </div>

            {shop?.slug && (
              <div className="pt-4 text-sm text-zinc-400">
                ✅ <span className="text-zinc-200 font-semibold">Esta é a url para você divulgar para seus clientes:</span>{" "}
                <span className="text-yellow-300 font-black">/agendar/{shop.slug}</span>
              </div>
            )}
          </section>
        )}

        <div className="text-xs text-zinc-500">
          Logado: <span className="text-zinc-300 font-semibold">{profile?.id}</span>
        </div>
      </div>
    </div>
  );
}
