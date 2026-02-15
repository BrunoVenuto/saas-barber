import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Shop = {
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

function waLink(raw: string | null) {
  const d = onlyDigits(raw || "");
  if (!d) return null;

  // Se já vier com 55, não duplica
  const final = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${final}`;
}

export default async function BarbershopLandingPage({
  params,
}: {
  params: { slug: string };
}) {
  const { supabase } = createClient();

  const { data: shop, error } = await supabase
    .from("barbershops")
    .select("id,name,slug,phone,whatsapp,address,city,instagram")
    .eq("slug", params.slug)
    .single();

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
        <div className="max-w-lg w-full bg-zinc-950 border border-white/10 rounded-2xl p-6">
          <h1 className="text-2xl font-black">Barbearia não encontrada</h1>
          <p className="text-zinc-400 mt-2">Verifique o link.</p>
        </div>
      </div>
    );
  }

  const s = shop as Shop;
  const wa = waLink(s.whatsapp);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HERO */}
      <section
        className="min-h-[60vh] flex items-center justify-center text-center relative"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1920)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div className="relative z-10 px-6 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            <span className="text-white">{s.name}</span>
          </h1>

          <p className="mt-6 text-zinc-300 text-lg">
            Agende online em segundos. Escolha o barbeiro, o serviço e o melhor
            horário.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/agendar/${s.slug}`}
              className="px-6 py-4 rounded-xl bg-yellow-400 text-black font-black hover:scale-[1.02] transition"
            >
              Agendar agora
            </Link>

            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 rounded-xl bg-emerald-500 text-black font-black hover:scale-[1.02] transition"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* INFO */}
      <section className="max-w-5xl mx-auto p-8">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-black text-yellow-400">Informações</h2>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-zinc-400 text-sm">Endereço</p>
              <p className="text-white font-semibold">{s.address || "—"}</p>
              <p className="text-zinc-300">{s.city || ""}</p>
            </div>

            <div>
              <p className="text-zinc-400 text-sm">Telefone</p>
              <p className="text-white font-semibold">{s.phone || "—"}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {s.instagram && (
                  <a
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition font-bold"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://instagram.com/${s.instagram.replace("@", "")}`}
                  >
                    Instagram
                  </a>
                )}

                <Link
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-black"
                  href={`/agendar/${s.slug}`}
                >
                  Ir para o agendamento
                </Link>
              </div>
            </div>
          </div>

          <p className="text-zinc-500 text-xs mt-6">
            Dica: o admin da barbearia pode editar esses dados em{" "}
            <span className="text-zinc-300 font-semibold">
              /admin/minha-barbearia
            </span>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
