import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Shield,
  MapPin,
  Tag,
  Truck,
  ShoppingCart,
  Radio,
  Forklift,
  Bike,
  Archive,
  Navigation,
  Sparkles,
  Command,
  ArrowRight,
  Battery,
  AlertTriangle,
} from 'lucide-react';
import { useAssets } from '../../context/AssetContext';
import { AssetDevice, AssetCategory } from '../../types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: AssetDevice) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onSelectAsset }) => {
  const { assets } = useAssets();
  const [query, setQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filtered = assets.filter((a) => {
    const matchesCategory =
      selectedCategoryFilter === 'all' || a.category === selectedCategoryFilter;
    if (!matchesCategory) return false;

    if (!query.trim()) return true;

    const q = query.toLowerCase().trim();
    return (
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.imei.toLowerCase().includes(q) ||
      a.unitName.toLowerCase().includes(q) ||
      (a.driverName && a.driverName.toLowerCase().includes(q)) ||
      (a.geofenceName && a.geofenceName.toLowerCase().includes(q))
    );
  });

  const results = query.trim() || selectedCategoryFilter !== 'all' ? filtered : assets.slice(0, 8);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        onSelectAsset(results[selectedIndex]);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelectAsset, onClose]);

  if (!isOpen) return null;

  const categoryFilters = [
    { key: 'all', label: 'Todos os Ativos', icon: Sparkles },
    { key: 'cart', label: 'Carrinhos', icon: ShoppingCart },
    { key: 'truck', label: 'Frotas', icon: Truck },
    { key: 'forklift', label: 'Empilhadeiras', icon: Forklift },
    { key: 'bike', label: 'Bicicletas', icon: Bike },
    { key: 'box', label: 'Caixas', icon: Archive },
    { key: 'tag', label: 'Tags BLE', icon: Tag },
  ];

  const getCategoryIcon = (cat: AssetCategory) => {
    switch (cat) {
      case 'cart':
        return <ShoppingCart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'truck':
      case 'vehicle':
        return <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'forklift':
        return <Forklift className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'bike':
        return <Bike className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'tag':
        return <Tag className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case 'box':
        return <Archive className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      default:
        return <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Banner with Executive Dashboard Header */}
        <div className="px-5 pt-3.5 pb-2.5 bg-gradient-to-r from-slate-100 via-cyan-500/10 to-slate-100 dark:from-slate-950 dark:via-cyan-500/10 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                Dashboard Executivo de Telemetria
              </h3>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 rounded-full uppercase">
                Ao Vivo
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Visão consolidada do parque de ativos, saúde de telemetria e cercas virtuais.
            </p>
          </div>
        </div>

        {/* Search Bar Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Search className="w-6 h-6" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Pesquisar por Código, Placa, IMEI, Unidade, Operador ou Cerca..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Quick Category Filters Pill Bar */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {categoryFilters.map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = selectedCategoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  setSelectedCategoryFilter(cat.key);
                  setSelectedIndex(0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {results.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
              <div className="text-base font-bold text-slate-700 dark:text-slate-300">
                Nenhum ativo localizado
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Não encontramos correspondências para "{query}" no filtro selecionado.
              </div>
            </div>
          ) : (
            <div>
              <div className="px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>{query || selectedCategoryFilter !== 'all' ? 'Resultados Encontrados' : 'Ativos em Destaque'}</span>
                <span>{results.length} itens</span>
              </div>
              <div className="space-y-1.5">
                {results.map((asset, index) => {
                  const isFocused = index === selectedIndex;
                  return (
                    <button
                      key={asset.id}
                      onClick={() => {
                        onSelectAsset(asset);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all duration-150 border ${
                        isFocused
                          ? 'bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/40 shadow-sm'
                          : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {asset.name}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 font-mono text-cyan-600 dark:text-cyan-400 text-[10px] font-bold rounded-lg shrink-0">
                              {asset.code}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1 truncate">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {asset.unitName}
                            </span>
                            <span>•</span>
                            <span>IMEI: <strong className="font-mono">{asset.imei}</strong></span>
                            {asset.driverName && (
                              <>
                                <span>•</span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  Op: {asset.driverName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="text-right hidden sm:block">
                          <div
                            className={`inline-block px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase ${
                              asset.status === 'moving'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : asset.status === 'out_of_geofence'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {asset.status === 'moving'
                              ? 'Em Movimento'
                              : asset.status === 'out_of_geofence'
                              ? 'Fora da Cerca'
                              : 'Parado'}
                          </div>
                          {asset.telemetry.speed > 0 && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              {asset.telemetry.speed} km/h
                            </div>
                          )}
                        </div>
                        <ArrowRight className={`w-4 h-4 transition-transform ${isFocused ? 'text-cyan-600 dark:text-cyan-400 translate-x-1' : 'text-slate-400'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>ATHOS Indexer Telemetria</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">↵</kbd> Selecionar</span>
          </div>
        </div>
      </div>
    </div>
  );
};

