"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ✅ Onboarding removido.
 * Se alguém acessar /admin/onboarding por link antigo, redireciona para
 * a área de configuração normal da barbearia.
 */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/minha-barbearia");
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-zinc-300">Redirecionando...</div>
    </div>
  );
}
