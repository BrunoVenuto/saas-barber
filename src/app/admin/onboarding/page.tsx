"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-md w-full text-center space-y-2">
        <h1 className="text-xl font-black text-yellow-400">
          Onboarding removido
        </h1>
        <p className="text-zinc-400 text-sm">
          Você será redirecionado para o painel.
        </p>
      </div>
    </div>
  );
}
