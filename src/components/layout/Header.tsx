import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  AlertTriangle,
  Sun,
  Moon,
  Building2,
  MapPin,
  ChevronDown,
  User,
  Settings,
  LogOut,
  ShieldAlert,
  Satellite,
  SlidersHorizontal,
  Sparkles,
  Command,
  Activity,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAssets } from '../../context/AssetContext';
import { GlobalSearch } from '../common/GlobalSearch';
import { UserRole } from '../../types';

interface HeaderProps {
  onOpenSidebarMobile?: () => void;
  onNavigate: (module: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const {
    user,
    theme,
    setTheme,
    logout,
    selectedClientId,
    selectedUnitId,
    setSelectedClientId,
    setSelectedUnitId,
    availableClients,
    availableUnits,
    setRole,
  } = useAuth();

  const { alerts, isLiveSimulationActive, toggleLiveSimulation, setSelectedAsset } = useAssets();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const unreadAlerts = alerts.filter((a) => !a.acknowledged);

  // Global Keyboard Shortcut listener for Ctrl+K or Cmd+K or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-16 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm backdrop-blur-xl transition-colors duration-300">
        {/* Left Section: Brand Logo & Company Selectors */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onNavigate('dashboard')}
            title="Ir para o Dashboard Principal"
          >
            <div className="relative w-9 h-9 shrink-0">
              <span className="absolute inset-0 rounded-xl bg-blue-500 opacity-0 group-hover:opacity-30 group-hover:animate-ping transition-opacity" />
              <div className="relative w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/25 ring-1 ring-white/10 group-hover:scale-105 transition-all duration-300">
                <Satellite className="w-4.5 h-4.5 text-white" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />
              </div>
            </div>
            <div>
              <div className="text-sm font-black tracking-wider text-slate-900 dark:text-white font-mono flex items-center gap-1">
                ATHOS <span className="text-blue-600 dark:text-blue-400 font-extrabold">TRACK</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-[1px] rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-semibold uppercase tracking-wide">
                  Telemetria Pro
                </span>
                <span className="px-1.5 py-[1px] rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 dark:text-slate-400 text-[8px] font-mono font-bold">
                  v3.2
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            {/* Empresa Selector */}
            <div className="relative group">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs shadow-inner hover:border-cyan-500/40 transition-all">
                <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedUnitId('all');
                  }}
                  className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-4 font-medium text-xs"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                    Todas as Empresas
                  </option>
                  {availableClients.map((cli) => (
                    <option key={cli.id} value={cli.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                      {cli.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unidade Selector */}
            <div className="relative group">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs shadow-inner hover:border-emerald-500/40 transition-all">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-4 font-medium text-xs"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                    Todas as Unidades
                  </option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Larger & Interactive Global Search Trigger */}
        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full relative flex items-center justify-between px-4 py-2 bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-500/50 rounded-2xl text-xs text-slate-600 dark:text-slate-400 transition-all duration-300 shadow-inner hover:shadow-md group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0 leading-tight">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs">
                  <span className="truncate">Dashboard Executivo de Telemetria</span>
                  <span className="px-1.5 py-0.2 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded text-[9px] font-mono uppercase font-bold shrink-0">
                    Ao Vivo
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Visão consolidada do parque de ativos, saúde de telemetria e cercas virtuais.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <span className="px-2 py-0.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 text-[10px] rounded-lg font-mono font-bold shadow-sm flex items-center gap-1 group-hover:border-cyan-500/40">
                <Command className="w-2.5 h-2.5" /> K
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden lg:inline">
                ou <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">/</kbd>
              </span>
            </div>
          </button>
        </div>

        {/* Right Section: Designer Controls (Live Sync, Critical Alerts, Notifications, Theme, Profile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Sync Status Button */}
          <button
            onClick={toggleLiveSimulation}
            title={isLiveSimulationActive ? 'Telemetria em Tempo Real Ativa (Clique para Pausar)' : 'Telemetria Pausada (Clique para Reativar)'}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all duration-300 shadow-sm active:scale-95 ${
              isLiveSimulationActive
                ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shadow-emerald-500/10'
                : 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isLiveSimulationActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveSimulationActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </span>
            <span className="hidden xl:inline tracking-wider">
              {isLiveSimulationActive ? 'REALTIME LIVE' : 'PAUSADO'}
            </span>
          </button>

          {/* Critical Alerts Badge Button */}
          <button
            onClick={() => onNavigate('alertas')}
            className="relative p-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 rounded-xl text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all duration-200 shadow-sm active:scale-95 group"
            title="Central de Alertas Críticos da Frota"
          >
            <AlertTriangle className="w-4.5 h-4.5 group-hover:rotate-12 transition-transform" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-mono font-black rounded-full flex items-center justify-center shadow-md shadow-rose-500/40 animate-pulse">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Drawer Toggle */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-2.5 rounded-xl border transition-all duration-200 shadow-sm active:scale-95 group ${
                isNotificationsOpen
                  ? 'bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-400'
                  : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/40'
              }`}
              title="Notificações e Eventos"
            >
              <Bell className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-3 w-88 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                      Notificações do Sistema
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full border border-cyan-500/20">
                    {alerts.length} eventos
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto my-2 space-y-2 pr-1">
                  {alerts.slice(0, 5).map((alt) => (
                    <div
                      key={alt.id}
                      className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs flex items-start gap-3 hover:border-cyan-500/30 transition-colors"
                    >
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          alt.severity === 'critical'
                            ? 'text-rose-500 dark:text-rose-400'
                            : alt.severity === 'warning'
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-cyan-500 dark:text-cyan-400'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-slate-200">{alt.title}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                          {alt.message}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                          {alt.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    onNavigate('alertas');
                  }}
                  className="w-full mt-2 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200"
                >
                  Central de Alertas Completa
                </button>
              </div>
            )}
          </div>

          {/* Designer Single Interactive Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            aria-label="Alternar Tema"
            className={`group relative p-2.5 rounded-xl transition-all duration-300 border flex items-center justify-center shadow-md active:scale-95 ${
              theme === 'dark'
                ? 'bg-slate-900/90 text-amber-400 border-amber-500/30 hover:border-amber-400 hover:bg-slate-800 shadow-amber-500/10'
                : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 shadow-indigo-500/10'
            }`}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]" />
            )}
          </button>

          {/* User Profile & Role Switcher */}
          <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="group flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
            >
              <div className="relative shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-cyan-500/40 object-cover shadow-sm transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-400 text-white font-bold text-xs rounded-full flex items-center justify-center shadow-md shadow-violet-500/20 transition-transform group-hover:scale-105">
                    {user?.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-950" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[11px] font-bold text-slate-900 dark:text-slate-200">
                  {user?.name}
                </div>
                <span className="inline-block mt-0.5 px-1.5 py-[1px] rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[8px] font-mono font-bold uppercase tracking-wide">
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 pointer-events-none" />

                <div className="relative flex items-center gap-2.5 p-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full border border-cyan-500/40 object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 shrink-0 bg-gradient-to-tr from-cyan-500 via-violet-500 to-fuchsia-400 text-white font-bold text-xs rounded-full flex items-center justify-center">
                      {user?.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{user?.email}</div>
                  </div>
                </div>

                {/* Simulation Role Switcher for testing RBAC permissions */}
                <div className="my-2.5 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1 font-mono">
                    <SlidersHorizontal className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>Simular Papel RBAC</span>
                  </div>
                  <select
                    value={user?.role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-[11px] rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 cursor-pointer font-medium transition-colors"
                  >
                    <option value="ATHOS_ADMIN">Administrador ATHOS</option>
                    <option value="CLIENT_ADMIN">Administrador Cliente</option>
                    <option value="FLEET_MANAGER">Gestor de Frota</option>
                    <option value="CART_MANAGER">Gestor de Carrinhos</option>
                    <option value="ASSET_MANAGER">Gestor de Patrimônio</option>
                    <option value="OPERATOR">Operador</option>
                    <option value="VIEWER">Visualizador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onNavigate('configuracoes');
                    }}
                    className="group/item w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all hover:translate-x-0.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover/item:rotate-45" />
                    <span>Configurações do Sistema</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl font-medium transition-all hover:translate-x-0.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da Plataforma</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAsset={(asset) => {
          setSelectedAsset(asset);
          onNavigate('mapa');
        }}
      />
    </>
  );
};

