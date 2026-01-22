"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function BarbeiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const menu = [
    { label: "📅 Agenda", href: "/barbeiro/dashboard" },
    { label: "🕒 Meus Horários", href: "/barbeiro/horarios" },
    { label: "📜 Histórico", href: "/barbeiro/historico" },
  ];

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

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="space-y-2">
        {menu.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block px-4 py-2 rounded transition ${
                active ? "bg-primary text-black font-bold" : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* MOBILE HEADER */}
      <header className="md:hidden sticky top-0 z-40 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition grid place-items-center"
            aria-label="Abrir menu"
          >
            {/* ícone hamburguer */}
            <span className="block w-5">
              <span className="block h-0.5 bg-white/80 rounded mb-1.5" />
              <span className="block h-0.5 bg-white/80 rounded mb-1.5" />
              <span className="block h-0.5 bg-white/80 rounded" />
            </span>
          </button>

          <div className="min-w-0">
            <p className="font-bold truncate">Barbeiro</p>
            <p className="text-[11px] opacity-70 -mt-0.5 truncate">
              Área do profissional
            </p>
          </div>

          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-white/10 grid place-items-center">
            <span className="font-black">BP</span>
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

          <aside className="absolute left-0 top-0 bottom-0 w-[84%] max-w-[320px] bg-surface border-r border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-primary">Barbeiro</h1>
                <p className="text-sm opacity-70">Menu</p>
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

            <NavLinks onNavigate={() => setOpen(false)} />

            <div className="pt-6 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-500/10"
              >
                🚪 Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="md:flex">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:block w-64 bg-surface border-r border-white/10 p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">Barbeiro</h1>
            <p className="text-sm opacity-70">Área do profissional</p>
          </div>

          <NavLinks />

          <div className="pt-6 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-500/10"
            >
              🚪 Sair
            </button>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
