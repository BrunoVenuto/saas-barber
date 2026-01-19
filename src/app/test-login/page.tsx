"use client";

import { createClient } from "@/lib/supabase/browser";

export default function TestLogin() {
  const supabase = createClient();

  async function login() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "brunovlviana41@gmail.com",
      password: "abc@1234",
    });

    console.log("LOGIN DATA:", data);
    console.log("LOGIN ERROR:", error);

    alert(error ? error.message : "Logou com sucesso");
  }

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();
    console.log("GET USER DATA:", data);
    console.log("GET USER ERROR:", error);

    alert(data?.user ? "Tem usuário logado" : "Não tem usuário logado");
  }

  async function logout() {
    await supabase.auth.signOut();
    alert("Deslogado");
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Teste de Login Supabase</h1>

      <button
        onClick={login}
        className="bg-green-600 text-white p-4 rounded"
      >
        Testar Login
      </button>

      <button
        onClick={getUser}
        className="bg-blue-600 text-white p-4 rounded"
      >
        Ver Usuário Logado
      </button>

      <button
        onClick={logout}
        className="bg-red-600 text-white p-4 rounded"
      >
        Logout
      </button>
    </div>
  );
}
