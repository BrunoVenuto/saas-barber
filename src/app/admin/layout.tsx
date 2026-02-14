"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type NavItem = {
  href: string;
  label: string;
};

type ProfileRole = "admin" | string;

type ProfileRow = {
  role: string | null;
  barbershop_id: string | null;
};

type BarbershopRow = {
  id: string;
  name: string | null;
};

type Profile = {
  role: ProfileRole | null;
  barbershop_id: string | null;
  _impersonating?: boolean;
  _shopName?: string | null;
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function getCookieValue(cookieName: string): string | null {
  const found = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${cookieName}=`));

  if (!found) return null;

  const value = found.split("=").slice(1).join("=");
  return value ? decodeURIComponent(value) : null;
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
        const active = pathname?.startsWith(item.href) ?? false;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cx(
              "px-4 py-2.5 rounded-xl transition border",
              active
                ? "bg-yellow-400/15 border-yellow-300/25 text-yellow-200"
                : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-white/85",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function useAdminGuard() {
  const supabase = createClient();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (userErr) {
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

      const profRow = prof as ProfileRow;

      const baseProfile: Profile = {
        role: (profRow.role ?? null) as ProfileRole | null,
        barbershop_id: profRow.barbershop_id ?? null,
      };

      const isSaasAdmin =
        baseProfile.role === "admin" && baseProfile.barbershop_id === null;

      if (isSaasAdmin) {
        const impersonatingId = getCookieValue("sb-impersonate-shop-id");

        if (impersonatingId) {
          const { data: impShop } = await supabase
            .from("barbershops")
            .select("id, name")
            .eq("id", impersonatingId)
            .single();

          if (!alive) return;

          if (impShop) {
            const shopRow = impShop as BarbershopRow;

            setProfile({
              role: "admin",
              barbershop_id: shopRow.id,
              _impersonating: true,
              _shopName: shopRow.name ?? null,
            });
            setChecking(false);
            return;
          }
        }
      }

      setProfile(baseProfile);
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  return { checking, profile };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { checking, profile } = useAdminGuard();

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

    return [{ href: "/admin/dashboard", label: "📊 Dashboard" }];
  }, [profile?.role, profile?.barbershop_id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
      {profile?._impersonating === true && (
        <div className="bg-yellow-400 text-black px-4 py-2 text-sm font-black flex items-center justify-between">
          <span>🔧 Configurando: {profile._shopName ?? "Barbearia"}</span>
          <button
            onClick={() => {
              document.cookie = "sb-impersonate-shop-id=; path=/; max-age=0";
              window.location.reload();
            }}
            className="underline hover:no-underline"
          >
            Sair do modo configuração
          </button>
        </div>
      )}

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
                <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center">
                  <span className="text-yellow-200 font-black">BP</span>
                </div>
                <div className="min-w-0">
                  <p className="font-black leading-tight truncate">Admin</p>
                  <p className="text-xs text-white/60 truncate">
                    Barber Premium
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <NavLinks items={navItems} onNavigate={() => setOpen(false)} />
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <Link
                href="/logout"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 rounded-xl transition border bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-white/85"
              >
                🚪 Sair
              </Link>
            </div>
          </aside>
        </div>
      )}

      <div className="md:flex">
        <aside className="hidden md:flex md:w-72 md:min-h-screen md:sticky md:top-0 bg-zinc-950 border-r border-white/10 p-6">
          <div className="w-full">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/25 grid place-items-center">
                <span className="text-yellow-200 font-black">BP</span>
              </div>
              <div className="min-w-0">
                <p className="font-black leading-tight truncate">Admin</p>
                <p className="text-xs text-white/60 truncate">Barber Premium</p>
              </div>
            </div>

            <div className="mt-6">
              <NavLinks items={navItems} />
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <Link
                href="/logout"
                className="block px-4 py-2.5 rounded-xl transition border bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-white/85"
              >
                🚪 Sair
              </Link>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
