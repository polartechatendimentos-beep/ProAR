"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

type AuthenticatedUser = {
  id: number;
  email: string;
  nome: string;
  role: string;
  companyId?: number;
};

type ProarLoginScreenProps = {
  onAuthenticated: (user: AuthenticatedUser) => void;
};

export function ProarLoginScreen({ onAuthenticated }: ProarLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, senha, remember }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.user) {
        setError(payload.message || "Não foi possível acessar o ProAR.");
        return;
      }

      onAuthenticated(payload.user);
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-5">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-24 size-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-blue-400/35 bg-blue-600 shadow-lg shadow-blue-950/60">
            <span className="text-3xl font-black tracking-tighter">P</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">ProAR</h1>
          <p className="mt-1 text-sm text-slate-300">Sistema de Gestão</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-2xl shadow-black/35 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Acessar o ProAR</h2>
            <p className="mt-1 text-sm text-slate-400">Entre com as credenciais já cadastradas.</p>
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Usuário ou e-mail</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-3 size-4 text-slate-400" aria-hidden="true" />
              <input
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="seuemail@empresa.com.br"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Senha</span>
            <span className="relative block">
              <LockKeyhole className="absolute left-3 top-3 size-4 text-slate-400" aria-hidden="true" />
              <input
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-3 pr-11 text-sm outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

          <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 rounded border-slate-600 bg-slate-950 accent-blue-500"
            />
            Lembrar de mim neste dispositivo
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Entrando..." : "Entrar no sistema"}
          </button>

          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <ShieldCheck className="size-4 text-emerald-400" />
            Seus dados estão protegidos com segurança
          </p>
        </form>
      </section>
    </main>
  );
}
