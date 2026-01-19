import Link from "next/link";
import { ReactNode } from "react";
import { getCurrentBarbershopIdBrowser } from "@/lib/getCurrentBarbershopBrowser";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const barbershopId = await getCurrentBarbershopIdBrowser();

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-xl font-bold text-yellow-400">Admin</h2>

        <nav className="flex flex-col gap-2">
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 rounded hover:bg-zinc-800"
          >
            📊 Dashboard
          </Link>

          <Link
            href="/admin/barbeiros"
            className="px-4 py-2 rounded hover:bg-zinc-800"
          >
            💈 Barbeiros
          </Link>

          <Link
            href="/admin/servicos"
            className="px-4 py-2 rounded hover:bg-zinc-800"
          >
            ✂️ Serviços
          </Link>

          <Link
            href="/admin/horarios"
            className="px-4 py-2 rounded hover:bg-zinc-800"
          >
            ⏰ Horários
          </Link>

          <Link
            href="/admin/minha-barbearia"
            className="px-4 py-2 rounded hover:bg-zinc-800"
          >
            🏪 Minha Barbearia
          </Link>
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
