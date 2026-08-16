import React, { useRef, useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, Mail, Eye, EyeOff, Satellite } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import worldMapImg from '../assets/images/login-world-map.png';

// Satélite orbitando um hub central — dois anéis girando em sentidos opostos
// (o externo carrega o satélite, o interno gira ao contrário na mesma
// velocidade pra manter o ícone sempre "de pé").
const OrbitingSatellite: React.FC = () => (
  <div className="relative w-64 h-64 shrink-0">
    <div className="absolute inset-0 rounded-full border border-cyan-400/15" />
    <div className="absolute inset-8 rounded-full border border-violet-400/10" />
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_24px_8px_rgba(34,211,238,0.45)]" />
    <div className="absolute inset-0 orbit-spin">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        <div className="orbit-counter-spin flex items-center justify-center w-10 h-10 rounded-full bg-slate-900/80 border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
          <Satellite className="w-4.5 h-4.5 text-cyan-300" />
        </div>
      </div>
    </div>
  </div>
);

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: px * 16, y: py * 16 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    if (!success) {
      setErrorMsg('Credenciais inválidas. Verifique seu e-mail e senha.');
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-end p-4 sm:p-8 lg:p-12 relative overflow-hidden"
    >
      {/* Mapa múndi de fundo, full-bleed, com leve parallax pelo mouse */}
      <img
        src={worldMapImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-[106%] h-[106%] -left-[3%] -top-[3%] object-cover pointer-events-none transition-transform duration-300 ease-out"
        style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-slate-950/15 to-slate-950/75 pointer-events-none" />

      {/* Satélite orbitando sobre o mapa (telas grandes) */}
      <div className="hidden lg:flex flex-col items-center gap-4 absolute left-16 top-1/2 -translate-y-1/2 z-10 login-stagger">
        <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono uppercase tracking-[0.2em]" style={{ animationDelay: '0.1s' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Rede ATHOS operacional
        </div>
        <div style={{ animationDelay: '0.2s' }}>
          <OrbitingSatellite />
        </div>
      </div>

      {/* Card de login com anel giratório multicolor — o "farol de sinal" do rastreamento */}
      <div
        className="login-card-enter relative w-full max-w-md z-10"
        style={{
          transform: `perspective(1200px) rotateX(${-parallax.y * 0.12}deg) rotateY(${parallax.x * 0.12}deg)`,
          transition: 'transform 300ms ease-out',
        }}
      >
        <div className="relative rounded-[28px] p-[2px] overflow-hidden shadow-2xl shadow-black/60">
          <div
            className="login-ring-spin absolute -inset-[75%]"
            style={{
              background:
                'conic-gradient(from 0deg, #22d3ee, #8b5cf6, #f472b6, #fbbf24, #34d399, #22d3ee)',
            }}
          />
          <div className="relative rounded-[26px] bg-slate-950/92 backdrop-blur-xl p-8">
            {/* Brand Header */}
            <div className="text-center mb-10">
              <div className="relative inline-flex items-center justify-center w-12 h-12 mb-3">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-400 animate-ping opacity-40" />
                <span
                  className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-400 animate-ping opacity-30"
                  style={{ animationDelay: '0.6s' }}
                />
                <div className="relative w-12 h-12 flex items-center justify-center bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-400 rounded-2xl shadow-xl shadow-violet-500/30 ring-1 ring-white/20">
                  <Satellite className="w-6 h-6 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-black tracking-wider text-white font-mono">
                ATHOS <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">TRACK</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Plataforma Enterprise de Rastreamento & Telemetria
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium text-center animate-[login-card-in_0.3s_ease-out]">
                {errorMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <label
                  htmlFor="login-email"
                  className="absolute top-0 left-8 -translate-y-1/2 px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider z-10"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 peer-focus:text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10 transition-colors" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="peer w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <label
                  htmlFor="login-password"
                  className="absolute top-0 left-8 -translate-y-1/2 px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider z-10"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 peer-focus:text-violet-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10 transition-colors" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="peer w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/70 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>Lembrar acesso</span>
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Instruções de recuperação foram enviadas para o seu e-mail cadastrado.');
                  }}
                  className="text-cyan-400 hover:underline font-medium"
                >
                  Recuperar senha
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-shine relative overflow-hidden w-full py-3 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-600/30 text-sm mt-2"
              >
                <span>{isSubmitting ? 'Entrando...' : 'Entrar na Central'}</span>
                <ArrowRight className={`w-4 h-4 transition-transform ${isSubmitting ? 'animate-pulse' : ''}`} />
              </button>
            </form>

            <div className="mt-8 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-500" />
              <span>Conexão Segura SSL Encrypted • ATHOS Cloud</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
