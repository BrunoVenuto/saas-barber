"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  role: string;
  barbershop_id: string | null;
  name: string | null;
};

type Barbershop = {
  id: string;
  name: string;
};

type NavItem = {
  href: string;
  label: string;
  platformOnly?: boolean; // ✅ só admin plataforma
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "📊 Dashboard" },

  // ✅ Barbearias (apenas admin da plataforma)
  { href: "/admin/saas/barbearias", label: "🏪 Barbearias", platformOnly: true },

  { href: "/admin/servicos", label: "✂️ Serviços" },
  { href: "/admin/relatorios", label: "📈 Relatórios" },
  { href: "/admin/planos", label: "💳 Planos" },
  { href: "/admin/minha-barbearia", label: "🏪 Minha Barbearia" },
];

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function NavLinks({
  onNavigate,
  items,
}: {
  onNavigate?: () => void;
  items: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cx(
              "px-4 py-2.5 rounded-xl transition border",
              active
                ? "bg-yellow-400/15 border-yellow-300/25 text-yellow-200"
                : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-white/85"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopName, setShopName] = useState<string>("");

  // trava scroll do body quando drawer abre (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // fecha drawer com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ✅ carrega profile + nome da barbearia (se tiver)
  useEffect(() => {
    (async () => {
      setLoadingProfile(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingProfile(false);
        router.replace("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role, barbershop_id, name")
        .eq("id", user.id)
        .single();

      if (profErr || !prof) {
        setProfile(null);
        setShopName("");
        setLoadingProfile(false);
        return;
      }

      const p = prof as Profile;
      setProfile(p);

      // se for admin de barbearia, pega o nome da barbearia
      if (p.barbershop_id) {
        const { data: bs } = await supabase
          .from("barbershops")
          .select("id, name")
          .eq("id", p.barbershop_id)
          .single();

        setShopName((bs as Barbershop | null)?.name || "");
      } else {
        setShopName(""); // admin plataforma
      }

      setLoadingProfile(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlatformAdmin = !!profile && profile.role === "admin" && profile.barbershop_id === null;

  const filteredNav = useMemo(() => {
    // enquanto carrega, deixa o menu sem itens “sensíveis”
    if (loadingProfile) {
      return NAV.filter((x) => !x.platformOnly);
    }
    if (isPlatformAdmin) return NAV;
    // admin de barbearia (ou qualquer outro) não vê “Barbearias”
    return NAV.filter((x) => !x.platformOnly);
  }, [loadingProfile, isPlatformAdmin]);

  const headerTitle = "Admin";
  const headerSubtitle = loadingProfile
    ? "Carregando..."
    : isPlatformAdmin
    ? "Plataforma"
    : shopName || "Minha barbearia";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* MOBILE HEADER */}
      <header className="md:hidden sticky top-0 z-40 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
            aria-label="Abrir menu"
          >
            <span className="block w-5">
              <span className="block h-0.5 bg-white/80 rounded mb-1.5" />
              <span className="block h-0.5 bg-white/80 rounded mb-1.5" />
              <span className="block h-0.5 bg-white/80 rounded" />
            </span>
          </button>

          <div className="min-w-0">
            <p className="font-black tracking-tight truncate">{headerTitle}</p>
            <p className="text-[11px] text-white/60 -mt-0.5 truncate">
              {headerSubtitle}
            </p>
          </div>

          <div className="h-11 w-11 rounded-xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center">
            <span className="text-yellow-200 font-black">BP</span>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          />

          <aside className="absolute left-0 top-0 bottom-0 w-[84%] max-w-[320px] bg-zinc-950 border-r border-white/10 p-5 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center shrink-0">
                  <span className="text-yellow-200 font-black">BP</span>
                </div>
                <div className="min-w-0">
                  <p className="font-black tracking-tight truncate">{headerTitle}</p>
                  <p className="text-[11px] text-white/60 -mt-0.5 truncate">
                    {headerSubtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <NavLinks onNavigate={() => setOpen(false)} items={filteredNav} />
            </div>

            <div className="mt-auto pt-5 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 rounded-xl border border-transparent hover:bg-red-500/10 hover:border-red-500/20 text-red-300 transition font-black"
              >
                🚪 Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="md:flex">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex w-72 shrink-0 p-6 bg-zinc-950 border-r border-white/10 flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center">
              <span className="text-yellow-200 font-black">BP</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-yellow-200">{headerTitle}</h2>
              <p className="text-xs text-white/60 -mt-0.5 truncate">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <NavLinks items={filteredNav} />

          <div className="mt-auto pt-6 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 rounded-xl border border-transparent hover:bg-red-500/10 hover:border-red-500/20 text-red-300 transition font-black"
            >
              🚪 Sair
            </button>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
