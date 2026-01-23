"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type NavItem = {
  href: string;
  label: string;
};

type Profile = {
  role: string | null;
  barbershop_id: string | null;
};

type Shop = {
  onboarded_at: string | null;
  onboarding_step: number | null;
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
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

/**
 * ✅ Guard melhorado:
 * - Admin SaaS (barbershop_id NULL): nunca passa por onboarding.
 * - Admin de barbearia:
 *   - se onboarded_at NULL => redireciona para /admin/onboarding
 *   - EXCETO: permite acessar a tela do "passo atual" durante onboarding:
 *     step 2: /admin/servicos
 *     step 3: /admin/barbeiros
 *     step 4: /admin/horarios
 */
function useOnboardingGuard() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Sempre deixa a própria página do onboarding carregar
      if (pathname?.startsWith("/admin/onboarding")) {
        if (!alive) return;
        setChecking(false);
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        if (!alive) return;
        setChecking(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (profErr || !prof) {
        setChecking(false);
        return;
      }

      const typedProf = prof as Profile;
      setProfile(typedProf);

      // ✅ Admin SaaS: libera tudo
      if (typedProf.role === "admin" && typedProf.barbershop_id === null) {
        setChecking(false);
        return;
      }

      // Se não é admin de barbearia, deixa middleware/rotas cuidarem
      if (typedProf.role !== "admin" || !typedProf.barbershop_id) {
        setChecking(false);
        return;
      }

      // Busca status do onboarding
      const { data: shop, error: shopErr } = await supabase
        .from("barbershops")
        .select("onboarded_at, onboarding_step")
        .eq("id", typedProf.barbershop_id)
        .single();

      if (shopErr) {
        setChecking(false);
        return;
      }

      const s = shop as Shop;

      // ✅ Se já onboarded: libera
      if (s?.onboarded_at) {
        setChecking(false);
        return;
      }

      // ✅ Ainda NÃO onboarded: permitir páginas do passo atual
      const step = s?.onboarding_step ?? 1;

      const allowedByStep = (() => {
        // sempre permite acessar a "Minha Barbearia" durante onboarding
        if (pathname?.startsWith("/admin/minha-barbearia")) return true;

        if (step <= 1) return pathname?.startsWith("/admin/onboarding") ?? false;

        if (step === 2) {
          return (
            (pathname?.startsWith("/admin/servicos") ?? false) ||
            (pathname?.startsWith("/admin/onboarding") ?? false)
          );
        }

        if (step === 3) {
          return (
            (pathname?.startsWith("/admin/barbeiros") ?? false) ||
            (pathname?.startsWith("/admin/onboarding") ?? false)
          );
        }

        // step 4
        return (
          (pathname?.startsWith("/admin/horarios") ?? false) ||
          (pathname?.startsWith("/admin/onboarding") ?? false)
        );
      })();

      if (!allowedByStep) {
        router.replace("/admin/onboarding");
        return;
      }

      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [pathname, router, supabase]);

  return { checking, profile };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { checking, profile } = useOnboardingGuard();

  // Menu dinâmico:
  // - Admin SaaS (barbershop_id NULL): mostra Barbearias/Planos
  // - Admin Barbearia: mostra Agenda/Serviços/Barbeiros/Horários etc
  const navItems = useMemo<NavItem[]>(() => {
    const isAdmin = profile?.role === "admin";
    const isSaasAdmin = isAdmin && profile?.barbershop_id === null;
    const isShopAdmin = isAdmin && !!profile?.barbershop_id;

    if (isSaasAdmin) {
      return [
        { href: "/admin/dashboard", label: "📊 Dashboard" },
        { href: "/admin/saas/barbearias", label: "🏪 Barbearias" },
        { href: "/admin/planos", label: "💳 Planos" },
      ];
    }

    if (isShopAdmin) {
      return [
        { href: "/admin/dashboard", label: "📊 Dashboard" },
        { href: "/admin/agenda", label: "📅 Agenda" },
        { href: "/admin/servicos", label: "✂️ Serviços" },
        { href: "/admin/barbeiros", label: "💈 Barbeiros" },
        { href: "/admin/horarios", label: "⏰ Horários" },
        { href: "/admin/relatorios", label: "📈 Relatórios" },
        { href: "/admin/minha-barbearia", label: "🏪 Minha Barbearia" },
      ];
    }

    // fallback (antes de carregar profile)
    return [{ href: "/admin/dashboard", label: "📊 Dashboard" }];
  }, [profile?.role, profile?.barbershop_id]);

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

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-zinc-300">Carregando...</div>
      </div>
    );
  }

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
            <p className="font-black tracking-tight truncate">Admin</p>
            <p className="text-[11px] text-white/60 -mt-0.5 truncate">
              Barber Premium
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

          <aside className="absolute left-0 top-0 bottom-0 w-[84%] max-w-[320px] bg-zinc-950 border-r border-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center shrink-0">
                  <span className="text-yellow-200 font-black">BP</span>
                </div>
                <div className="min-w-0">
                  <p className="font-black tracking-tight truncate">Admin</p>
                  <p className="text-[11px] text-white/60 -mt-0.5 truncate">
                    Menu
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
              <NavLinks items={navItems} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="md:flex">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:block w-72 shrink-0 p-6 bg-zinc-950 border-r border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center">
              <span className="text-yellow-200 font-black">BP</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-yellow-200">Admin</h2>
              <p className="text-xs text-white/60 -mt-0.5">Barber Premium</p>
            </div>
          </div>

          <NavLinks items={navItems} />
        </aside>

        {/* CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
