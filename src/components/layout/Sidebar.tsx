import React, { useState } from 'react';
import {
  LayoutDashboard,
  Map,
  Clock,
  Cpu,
  AlertTriangle,
  FileBarChart2,
  ShoppingCart,
  Box,
  Truck,
  PackageCheck,
  Forklift,
  Bike,
  Tag,
  Sprout,
  Users,
  Building2,
  MapPin,
  ShieldCheck,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Wrench,
  ShieldAlert,
  Radio,
  Archive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentModule: string;
  onSelectModule: (moduleKey: string) => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onSelectModule }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { canAccessModule } = useAuth();

  const mainItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'mapa', label: 'Mapa ao Vivo', icon: Map, badge: 'Ao Vivo' },
    { key: 'historico', label: 'Histórico', icon: Clock },
    { key: 'dispositivos', label: 'Dispositivos', icon: Cpu },
    { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { key: 'relatorios', label: 'Relatórios', icon: FileBarChart2 },
  ];

  const verticalModules: NavItem[] = [
    { key: 'carrinhos', label: 'Carrinhos', icon: ShoppingCart, highlight: true },
    { key: 'caixas', label: 'Caixas', icon: Archive, highlight: true },
    { key: 'ativos', label: 'Ativos & Equipamentos', icon: Box },
    { key: 'frotas', label: 'Frotas', icon: Truck },
    { key: 'cargas', label: 'Cargas', icon: PackageCheck },
    { key: 'empilhadeiras', label: 'Empilhadeiras', icon: Forklift },
    { key: 'bicicletas', label: 'Bicicletas', icon: Bike },
    { key: 'tags', label: 'Tags & Dispositivos', icon: Tag },
    { key: 'agro', label: 'ATHOS Agro Track', icon: Sprout },
  ];

  const adminItems: NavItem[] = [
    { key: 'clientes', label: 'Clientes', icon: Building2 },
    { key: 'unidades', label: 'Unidades', icon: MapPin },
    { key: 'usuarios', label: 'Usuários', icon: Users },
    { key: 'cercas', label: 'Cercas Virtuais', icon: Layers },
    { key: 'ordens_servico', label: 'Ordens de Serviço', icon: Wrench },
    { key: 'recuperacao_ativos', label: 'Recuperação de Ativos', icon: ShieldAlert },
    { key: 'homologacao_gt06', label: 'Homologação GT06', icon: Radio },
    { key: 'permissoes', label: 'Grupos & Permissões', icon: ShieldCheck },
    { key: 'integracoes', label: 'Integrações & API', icon: Globe },
    { key: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const getItemColorClasses = (key: string, isActive: boolean) => {
    const colors: Record<string, { active: string; iconActive: string; iconHover: string }> = {
      dashboard: {
        active: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 shadow-sm shadow-cyan-500/10 font-bold',
        iconActive: 'text-cyan-600 dark:text-cyan-400',
        iconHover: 'group-hover:text-cyan-500',
      },
      mapa: {
        active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10 font-bold',
        iconActive: 'text-emerald-600 dark:text-emerald-400',
        iconHover: 'group-hover:text-emerald-500',
      },
      dispositivos: {
        active: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 shadow-sm shadow-indigo-500/10 font-bold',
        iconActive: 'text-indigo-600 dark:text-indigo-400',
        iconHover: 'group-hover:text-indigo-500',
      },
      alertas: {
        active: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30 shadow-sm shadow-rose-500/10 font-bold',
        iconActive: 'text-rose-600 dark:text-rose-400',
        iconHover: 'group-hover:text-rose-500',
      },
      relatorios: {
        active: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 shadow-sm shadow-amber-500/10 font-bold',
        iconActive: 'text-amber-600 dark:text-amber-400',
        iconHover: 'group-hover:text-amber-500',
      },
      carrinhos: {
        active: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 shadow-sm font-bold',
        iconActive: 'text-cyan-600 dark:text-cyan-400',
        iconHover: 'group-hover:text-cyan-500',
      },
      ativos: {
        active: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 shadow-sm font-bold',
        iconActive: 'text-indigo-600 dark:text-indigo-400',
        iconHover: 'group-hover:text-indigo-500',
      },
      frotas: {
        active: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 shadow-sm font-bold',
        iconActive: 'text-amber-600 dark:text-amber-400',
        iconHover: 'group-hover:text-amber-500',
      },
      cargas: {
        active: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 shadow-sm font-bold',
        iconActive: 'text-purple-600 dark:text-purple-400',
        iconHover: 'group-hover:text-purple-500',
      },
      empilhadeiras: {
        active: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 shadow-sm font-bold',
        iconActive: 'text-amber-600 dark:text-amber-400',
        iconHover: 'group-hover:text-amber-500',
      },
      bicicletas: {
        active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 shadow-sm font-bold',
        iconActive: 'text-emerald-600 dark:text-emerald-400',
        iconHover: 'group-hover:text-emerald-500',
      },
      tags: {
        active: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30 shadow-sm font-bold',
        iconActive: 'text-violet-600 dark:text-violet-400',
        iconHover: 'group-hover:text-violet-500',
      },
      agro: {
        active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 shadow-sm font-bold',
        iconActive: 'text-emerald-600 dark:text-emerald-400',
        iconHover: 'group-hover:text-emerald-500',
      },
      ordens_servico: {
        active: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 shadow-sm font-bold',
        iconActive: 'text-indigo-600 dark:text-indigo-400',
        iconHover: 'group-hover:text-indigo-500',
      },
      recuperacao_ativos: {
        active: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30 shadow-sm font-bold',
        iconActive: 'text-rose-600 dark:text-rose-400',
        iconHover: 'group-hover:text-rose-500',
      },
      homologacao_gt06: {
        active: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 shadow-sm font-bold',
        iconActive: 'text-amber-600 dark:text-amber-400',
        iconHover: 'group-hover:text-amber-500',
      },
    };

    const cfg = colors[key] || {
      active: 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold',
      iconActive: 'text-cyan-500',
      iconHover: 'group-hover:text-cyan-400',
    };

    if (isActive) {
      return `${cfg.active} border`;
    }
    return `text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent`;
  };

  const renderNavGroup = (title: string, items: NavItem[]) => {
    const accessibleItems = items.filter((item) => canAccessModule(item.key));
    if (accessibleItems.length === 0) return null;

    return (
      <div className="mb-6">
        {!isCollapsed && (
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
            {title}
          </div>
        )}
        <div className="space-y-1">
          {accessibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectModule(item.key)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${getItemColorClasses(
                  item.key,
                  isActive
                )}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-all duration-200 group-hover:scale-110 ${
                    isActive
                      ? 'scale-110'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded font-semibold animate-pulse">
                    {item.badge}
                  </span>
                )}
                {!isCollapsed && item.highlight && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-sm shadow-cyan-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col relative z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center z-30 shadow-md transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Navigation Links Scroll Container */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {renderNavGroup('Menu Principal', mainItems)}
        {renderNavGroup('Módulos de Ativos', verticalModules)}
        {renderNavGroup('Área Administrativa', adminItems)}
      </div>

      {/* Footer System Status Banner */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 m-2 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="truncate">
            <div className="font-semibold text-slate-300">ATHOS Telemetry v2.4</div>
            <div className="text-[10px] font-mono text-slate-500">Node Cluster Online</div>
          </div>
        </div>
      )}
    </aside>
  );
};
