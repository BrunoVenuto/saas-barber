"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function BarbeiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const menu = [
    { label: "📅 Agenda", href: "/barbeiro/dashboard" },
    { label: "🕒 Meus Horários", href: "/barbeiro/horarios" },
    { label: "📜 Histórico", href: "/barbeiro/historico" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-white/10 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Barbeiro</h1>
          <p className="text-sm opacity-70">Área do profissional</p>
        </div>

        <nav className="space-y-2">
          {menu.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded transition ${
                  active
                    ? "bg-primary text-black font-bold"
                    : "hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-500/10"
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
