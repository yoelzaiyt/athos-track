import React, { useState } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, Truck, Forklift, Bike, Box, Radio, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export const LiveMapPage: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, selectedAsset, setSelectedAsset } = useAssets();
  const assets = getFilteredAssets(selectedClientId, selectedUnitId);

  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [query, setQuery] = useState('');

  const filtered = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.code.toLowerCase().includes(query.toLowerCase()) ||
      a.unitName.toLowerCase().includes(query.toLowerCase())
  );

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'cart':
        return <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />;
      case 'truck':
      case 'vehicle':
        return <Truck className="w-3.5 h-3.5 text-amber-400" />;
      case 'forklift':
        return <Forklift className="w-3.5 h-3.5 text-yellow-400" />;
      case 'bike':
        return <Bike className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Side Asset Selector Tree Drawer */}
      <div
        className={`bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-20 ${
          isTreeOpen ? 'w-80' : 'w-0 border-r-0'
        } overflow-hidden`}
      >
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Árvore de Ativos ({filtered.length})
            </h3>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar lista de ativos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((asset) => {
            const isSelected = selectedAsset?.id === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between border ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-md'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 bg-slate-800 rounded-lg shrink-0">
                    {getCategoryIcon(asset.category)}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{asset.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {asset.code} • {asset.unitName}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      asset.status === 'moving'
                        ? 'bg-emerald-400 animate-pulse'
                        : asset.status === 'out_of_geofence'
                        ? 'bg-rose-500'
                        : 'bg-slate-500'
                    }`}
                  />
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                    {asset.telemetry.speed} km/h
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drawer Toggle */}
      <button
        onClick={() => setIsTreeOpen(!isTreeOpen)}
        className="absolute left-2 top-20 z-30 p-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl shadow-xl transition-colors"
        title="Alternar Árvore de Ativos"
      >
        {isTreeOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Live Map Canvas */}
      <div className="flex-1 h-full">
        <LiveMap heightClass="h-full" />
      </div>
    </div>
  );
};
