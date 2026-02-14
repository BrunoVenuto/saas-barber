import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="text-zinc-300">Carregando...</div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
