import React, { useState } from 'react';
import { Radio, ShieldCheck, ArrowRight, Lock, Mail, Eye, EyeOff, Sparkles, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_EMAIL = 'demo@athostrack.io';
const DEMO_PASSWORD = 'athosdemo123';

export const Login: React.FC = () => {
  const { login, theme, toggleTheme } = useAuth();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    if (!success) {
      setErrorMsg('Credenciais inválidas. Utilize o ambiente demonstrativo abaixo.');
    }
  };

  const handleFillDemo = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErrorMsg('');
    setIsSubmitting(true);
    const success = await login(DEMO_EMAIL, DEMO_PASSWORD);
    setIsSubmitting(false);
    if (!success) {
      setErrorMsg('Não foi possível acessar o ambiente demonstrativo agora.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 relative overflow-hidden transition-colors">
      {/* Background Decorative Mesh Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme Toggle Top Right */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        title="Alternar Tema"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-2xl shadow-xl shadow-cyan-500/20 mb-3 ring-1 ring-cyan-400/30">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-slate-900 dark:text-white font-mono">
            ATHOS <span className="text-cyan-600 dark:text-cyan-400">TRACK</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Plataforma Enterprise de Rastreamento & Telemetria
          </p>
        </div>

        {/* Demo Credentials Auto-Fill Banner */}
        <div className="mb-6 p-3.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Ambiente Demonstrativo
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              {DEMO_EMAIL} / senha: {DEMO_PASSWORD}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-md shadow-cyan-600/30 transition-all shrink-0"
          >
            Acessar
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium text-center">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              E-mail de Acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-cyan-600 focus:ring-0"
              />
              <span>Lembrar acesso</span>
            </label>
            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                alert('Instruções de recuperação foram enviadas para o seu e-mail cadastrado.');
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
            >
              Recuperar senha
            </a>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/20 text-sm mt-2"
          >
            <span>{isSubmitting ? 'Entrando...' : 'Entrar na Central'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-500" />
          <span>Conexão Segura SSL Encrypted • ATHOS Cloud</span>
        </div>
      </div>
    </div>
  );
};
