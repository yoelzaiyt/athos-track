// Tela pública de redefinição de senha (SEC-010 fase 2). Montada FORA do
// AuthProvider (ver src/App.tsx, mesmo padrão de /homologacao): quem chega
// aqui, por definição, não consegue logar — exigir sessão seria um
// contrassenso.
//
// O token vem na query string (?token=...), gerado por
// POST /auth/password-reset/request e entregue por e-mail. A tela valida o
// link no mount, então o usuário descobre que expirou ANTES de digitar a
// senha nova, não depois.

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Espelha validateNewPassword() de server/api/passwordReset.ts. O servidor
// continua sendo a autoridade (esta cópia só evita o round-trip pra dizer o
// óbvio); se as duas divergirem, quem manda é a resposta da API.
const MIN_PASSWORD_LENGTH = 8;

function localPasswordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(password)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(password)) return 'A senha precisa ter pelo menos um número.';
  return null;
}

type LinkState =
  | { status: 'checking' }
  | { status: 'valid'; email: string; expiresAt: string }
  | { status: 'invalid'; message: string };

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [link, setLink] = useState<LinkState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLink({ status: 'invalid', message: 'Link incompleto: falta o código de redefinição. Abra o link exatamente como veio no e-mail.' });
      return;
    }
    (async () => {
      const { data, error } = await supabase.auth.validatePasswordResetToken(token);
      if (cancelled) return;
      if (error || !data?.valid) {
        setLink({
          status: 'invalid',
          message: error?.message ?? 'Este link de redefinição não é mais válido. Peça um novo na tela de login.',
        });
        return;
      }
      setLink({ status: 'valid', email: data.email, expiresAt: data.expiresAt });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const localError = localPasswordError(password);
    if (localError) {
      setErrorMsg(localError);
      return;
    }
    if (password !== confirmation) {
      setErrorMsg('As duas senhas não são iguais.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.confirmPasswordReset(token, password);
    setIsSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setDone(true);
  };

  const expiresLabel =
    link.status === 'valid'
      ? new Date(link.expiresAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      : null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 font-sans antialiased">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-400 uppercase">ATHOS TRACK</p>
          <h1 className="mt-1 text-lg font-bold text-slate-100">Redefinir senha</h1>

          {link.status === 'checking' && (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando o link...
            </p>
          )}

          {link.status === 'invalid' && (
            <div className="mt-6 space-y-4">
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{link.message}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </button>
            </div>
          )}

          {link.status === 'valid' && !done && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Definindo uma nova senha para <span className="text-slate-200 font-semibold">{link.email}</span>.
                {expiresLabel && <> Este link vale até <span className="text-slate-200">{expiresLabel}</span>.</>}
              </p>

              <div className="relative">
                <label htmlFor="reset-password" className="absolute top-0 left-8 -translate-y-1/2 px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider z-10 bg-slate-900">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/70 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400 transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="relative">
                <label htmlFor="reset-password-confirm" className="absolute top-0 left-8 -translate-y-1/2 px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider z-10 bg-slate-900">
                  Repita a senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
                  <input
                    id="reset-password-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/70 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com pelo menos uma letra e um número. Ao confirmar, todas as
                sessões abertas desta conta são encerradas.
              </p>

              {errorMsg && (
                <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isSubmitting ? 'Salvando...' : 'Salvar nova senha'}</span>
              </button>
            </form>
          )}

          {done && (
            <div className="mt-6 space-y-4">
              <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Senha redefinida. As sessões antigas desta conta foram encerradas — entre novamente com a senha nova.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 hover:brightness-110 text-white font-bold rounded-xl text-sm transition-all"
              >
                Ir para o login
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-600 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> Conexão segura • ATHOS Cloud
        </p>
      </div>
    </div>
  );
};
