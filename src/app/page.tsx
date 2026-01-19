import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-10 py-32 grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h1 className="text-5xl md:text-6xl font-black leading-tight">
            Transforme sua{" "}
            <span className="text-orange-400">barbearia</span> em uma máquina de
            agendamentos automática
          </h1>

          <p className="text-lg text-white/70">
            Um sistema moderno para gerenciar clientes, barbeiros e horários —
            tudo automático, sem bagunça e sem perder dinheiro.
          </p>

          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="primary" className="text-lg px-8 py-4">
                🚀 Testar agora
              </Button>
            </Link>

            <a
              href="https://wa.me/5531995453632"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" className="text-lg px-8 py-4">
                💬 Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>

        <Card className="p-10">
          <p className="text-xl font-bold text-orange-400 mb-4">
            O que você ganha:
          </p>
          <ul className="space-y-3 text-white/80">
            <li>✅ Clientes marcam sozinhos</li>
            <li>✅ Agenda organizada automaticamente</li>
            <li>✅ Menos faltas e confusão</li>
            <li>✅ Controle total da barbearia</li>
            <li>✅ Visual profissional</li>
          </ul>
        </Card>
      </section>

      {/* BENEFÍCIOS */}
      <section className="max-w-7xl mx-auto px-10 py-24 grid md:grid-cols-3 gap-8">
        <Card>
          <h3 className="text-xl font-bold text-orange-400 mb-2">
            📅 Agenda Inteligente
          </h3>
          <p className="text-white/70">
            O sistema só mostra horários livres e evita conflitos
            automaticamente.
          </p>
        </Card>

        <Card>
          <h3 className="text-xl font-bold text-orange-400 mb-2">
            ✂️ Gestão de Barbeiros
          </h3>
          <p className="text-white/70">
            Cada barbeiro tem sua própria agenda e painel profissional.
          </p>
        </Card>

        <Card>
          <h3 className="text-xl font-bold text-orange-400 mb-2">
            📊 Controle Total
          </h3>
          <p className="text-white/70">
            Veja relatórios, histórico e estatísticas da barbearia.
          </p>
        </Card>
      </section>

      {/* CTA FINAL */}
      <section className="text-center py-32 space-y-8">
        <h2 className="text-4xl font-black">
          Comece a usar hoje mesmo
        </h2>
        <p className="text-white/60">
          Leva menos de 2 minutos para testar o sistema.
        </p>

        <Link href="/login">
          <Button variant="primary" className="text-lg px-10 py-4">
            🔥 Quero testar agora
          </Button>
        </Link>
      </section>
    </main>
  );
}
