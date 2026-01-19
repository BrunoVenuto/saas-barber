import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Fundo madeira + vinheta pesada */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=2600&auto=format&fit=crop)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.15) contrast(1.12) brightness(0.9)",
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/55" />
      <div className="fixed inset-0 -z-10 shadow-[inset_0_0_220px_rgba(0,0,0,0.95)]" />
      <div className="fixed inset-0 -z-10 shadow-[inset_0_0_90px_rgba(0,0,0,0.9)]" />

      {/* “Palco” central arredondado (igual vibe da referência) */}
      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative rounded-[34px] overflow-hidden border border-white/10 bg-black/25 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
            {/* brilho sutil dourado nas bordas */}
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(255,200,40,0.12)]" />
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.65)]" />

            {/* Topbar estilo “glass” */}
            <header className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 border-b border-white/10 bg-black/25">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-yellow-400/15 border border-yellow-300/30 grid place-items-center shadow-[0_0_35px_rgba(255,210,80,0.18)]">
                    <span className="text-yellow-300 font-black">BP</span>
                  </div>
                  <div className="leading-tight">
                    <p className="font-black tracking-tight text-base sm:text-lg">
                      Barber Premium
                    </p>
                    <p className="text-xs text-white/65 -mt-0.5">
                      SaaS de agendamento para barbearias
                    </p>
                  </div>
                </div>

                <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
                  <a href="#recursos" className="hover:text-white transition">
                    Recursos
                  </a>
                  <a href="#como-funciona" className="hover:text-white transition">
                    Como funciona
                  </a>
                  <a href="#exemplo" className="hover:text-white transition">
                    Exemplo
                  </a>
                </nav>

                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition font-bold"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-black hover:brightness-110 transition shadow-[0_10px_40px_rgba(255,215,70,0.22)]"
                  >
                    Começar
                  </Link>
                </div>
              </div>
            </header>

            {/* HERO */}
            <section className="relative">
              {/* imagem hero dentro do palco */}
              <div
                className="relative h-[360px] sm:h-[460px] lg:h-[520px]"
                style={{
                  backgroundImage:
                    "url(https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=2400&auto=format&fit=crop)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "saturate(1.05) contrast(1.05)",
                }}
              >
                {/* overlay igual referência: escurece, mas deixa a imagem viva */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/20" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

                {/* Conteúdo */}
                <div className="absolute inset-0 px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
                  <div className="h-full flex items-end">
                    <div className="max-w-2xl">
                      <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-300/25 text-yellow-200 text-xs font-bold shadow-[0_0_35px_rgba(255,210,80,0.12)]">
                        ⚡ Agendamento online + confirmação no WhatsApp
                      </p>

                      <h1 className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                        A cara <span className="text-yellow-300">premium</span>{" "}
                        da sua barbearia — com agenda organizada
                      </h1>

                      <p className="mt-4 text-white/80 text-base sm:text-lg leading-relaxed">
                        Seu cliente agenda em segundos. O barbeiro confirma e
                        cancela com antecedência pelo WhatsApp. Tudo separado por
                        barbearia (multi-tenant), com painel do dono e painel do barbeiro.
                      </p>

                      <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <Link
                          href="/login"
                          className="h-12 sm:h-14 px-8 rounded-2xl bg-yellow-400 text-black font-black grid place-items-center hover:brightness-110 transition shadow-[0_16px_60px_rgba(255,215,70,0.28)]"
                        >
                          🚀 Testar agora
                        </Link>

                        <a
                          href="#exemplo"
                          className="h-12 sm:h-14 px-8 rounded-2xl bg-white/10 border border-white/10 font-black grid place-items-center hover:bg-white/15 transition"
                        >
                          Ver exemplo de landing
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA “flutuante” estilo referência (canto direito) */}
                <div className="hidden lg:block absolute right-10 bottom-10">
                  <Link
                    href="/login"
                    className="px-10 py-4 rounded-2xl bg-yellow-400 text-black font-black text-lg hover:brightness-110 transition shadow-[0_18px_70px_rgba(255,215,70,0.34)]"
                  >
                    Começar
                  </Link>
                </div>
              </div>
            </section>

            {/* Conteúdo abaixo do hero */}
            <section className="px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-black/35 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Conversão</p>
                  <p className="text-xl font-black text-yellow-200">Alta</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Agendamento</p>
                  <p className="text-xl font-black text-yellow-200">Rápido</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-4">
                  <p className="text-xs text-white/60">No-show</p>
                  <p className="text-xl font-black text-yellow-200">↓</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-4">
                  <p className="text-xs text-white/60">Multi-tenant</p>
                  <p className="text-xl font-black text-yellow-200">OK</p>
                </div>
              </div>

              {/* Recursos */}
              <div className="mt-10" id="recursos">
                <h2 className="text-2xl sm:text-3xl font-black">
                  Recursos <span className="text-yellow-300">principais</span>
                </h2>
                <p className="text-white/70 mt-2 max-w-2xl">
                  Painel do dono, painel do barbeiro, agenda por slots e landing premium
                  para conversão.
                </p>

                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                    <p className="font-black text-yellow-200 text-lg">📅 Agenda por slots</p>
                    <p className="text-sm text-white/70 mt-2">
                      Horários gerados pela duração do serviço e bloqueio automático de horários ocupados.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                    <p className="font-black text-yellow-200 text-lg">💬 WhatsApp integrado</p>
                    <p className="text-sm text-white/70 mt-2">
                      Confirmação e cancelamento com mensagem pronta. Cliente deixa nome e WhatsApp no agendamento.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                    <p className="font-black text-yellow-200 text-lg">💈 Painel do barbeiro</p>
                    <p className="text-sm text-white/70 mt-2">
                      Lista do dia com status, confirmação/cancelamento e regra de antecedência.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                    <p className="font-black text-yellow-200 text-lg">📊 Relatórios</p>
                    <p className="text-sm text-white/70 mt-2">
                      Ranking de serviços e faturamento estimado por período (por barbearia).
                    </p>
                  </div>
                </div>
              </div>

              {/* Exemplo */}
              <div className="mt-12" id="exemplo">
                <div className="rounded-[28px] border border-white/10 bg-black/30 overflow-hidden">
                  <div className="p-6 sm:p-8 border-b border-white/10">
                    <h3 className="text-xl sm:text-2xl font-black">
                      Exemplo de landing <span className="text-yellow-300">premium</span>
                    </h3>
                    <p className="text-white/70 mt-2">
                      O template da barbearia vai seguir essa vibe amadeirada e dourada.
                    </p>
                  </div>

                  <div className="p-6 sm:p-8 grid lg:grid-cols-2 gap-5 items-center">
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <p className="text-xs text-white/60">Seções</p>
                        <p className="font-black">
                          Hero • Serviços • Barbeiros • Preços • CTA
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <p className="text-xs text-white/60">CTA</p>
                        <p className="font-black text-yellow-200">Agendar agora</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <p className="text-xs text-white/60">Objetivo</p>
                        <p className="font-black">Converter visitante em agendamento</p>
                      </div>

                      <div className="pt-2">
                        <Link
                          href="/login"
                          className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-yellow-400 text-black font-black hover:brightness-110 transition shadow-[0_16px_60px_rgba(255,215,70,0.25)]"
                        >
                          Quero isso na minha barbearia
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-[28px] overflow-hidden border border-white/10 bg-black/35">
                      <div
                        className="h-[240px] sm:h-[320px]"
                        style={{
                          backgroundImage:
                            "url(https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=1174&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <div className="h-full w-full bg-gradient-to-t from-black/80 via-black/30 to-black/10 flex items-end p-5">
                          <div className="rounded-3xl bg-black/45 border border-white/10 backdrop-blur-md p-4 w-full">
                            <p className="text-xs text-white/70 font-bold">
                              Barbearia Exemplo
                            </p>
                            <p className="text-lg font-black">IRON BEARD</p>
                            <div className="mt-3 h-11 rounded-2xl bg-yellow-400 text-black font-black grid place-items-center shadow-[0_14px_55px_rgba(255,215,70,0.25)]">
                              Agendar
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Como funciona */}
              <div className="mt-12" id="como-funciona">
                <h2 className="text-2xl sm:text-3xl font-black">
                  Como funciona (simples)
                </h2>

                <div className="mt-5 grid md:grid-cols-3 gap-4">
                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6">
                    <p className="text-yellow-200 font-black">1) Cliente agenda</p>
                    <p className="text-sm text-white/70 mt-2">
                      Escolhe barbeiro, serviço e horário. Informa nome e WhatsApp.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6">
                    <p className="text-yellow-200 font-black">2) Barbeiro confirma</p>
                    <p className="text-sm text-white/70 mt-2">
                      1 clique abre WhatsApp e atualiza status no sistema.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/35 border border-white/10 p-6">
                    <p className="text-yellow-200 font-black">3) Tudo registrado</p>
                    <p className="text-sm text-white/70 mt-2">
                      Histórico + relatórios por barbearia, sem bagunça.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/login"
                    className="h-12 sm:h-14 px-8 rounded-2xl bg-yellow-400 text-black font-black grid place-items-center hover:brightness-110 transition shadow-[0_16px_60px_rgba(255,215,70,0.25)]"
                  >
                    Criar minha conta
                  </Link>
                  <a
                    href="https://wa.me/5531995453632"
                    target="_blank"
                    rel="noreferrer"
                    className="h-12 sm:h-14 px-8 rounded-2xl bg-emerald-500 text-black font-black grid place-items-center hover:brightness-110 transition"
                  >
                    Falar no WhatsApp
                  </a>
                </div>
              </div>
            </section>

            {/* Footer dentro do palco */}
            <footer className="px-4 sm:px-6 lg:px-8 pb-8 pt-2 border-t border-white/10 bg-black/20">
              <div className="text-center text-xs text-white/55">
                © {new Date().getFullYear()} Barber Premium — Todos os direitos reservados.
              </div>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
