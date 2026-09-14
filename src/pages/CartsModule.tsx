import React, { useState } from 'react';
import { ShoppingCart, BatteryLow, ShieldAlert, Wrench, Radio, CheckCircle2, Map as MapIcon, ShieldCheck, Camera } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { RecoveryFormModal } from '../components/common/RecoveryFormModal';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { cartColumns } from './columns/cartColumns';

export const CartsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId, user } = useAuth();
  const { getFilteredAssets, setSelectedAsset, recoveries, recoverAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);
  const [recoveringAsset, setRecoveringAsset] = useState<AssetDevice | null>(null);

  const allAssets = getFilteredAssets(selectedClientId, selectedUnitId);
  const cartAssets = allAssets.filter((a) => a.category === 'cart');
  const cartAssetIds = new Set(cartAssets.map((c) => c.id));
  const cartRecoveries = recoveries.filter((r) => cartAssetIds.has(r.assetId));

  // KPIs calculados a partir dos carrinhos reais filtrados (não mais números
  // fixos de demonstração) — seção 22 do brief de integração BRGPS.
  const totalCarts = cartAssets.length;
  const insideUnit = cartAssets.filter((c) => c.status !== 'out_of_geofence').length;
  const outsideUnit = cartAssets.filter((c) => c.status === 'out_of_geofence').length;
  const noComm = cartAssets.filter((c) => c.status === 'offline').length;
  const lowBat = cartAssets.filter(
    (c) => c.telemetry.batteryLevelCategory === 'CRITICAL' || c.telemetry.batteryLevelCategory === 'LOW' || (c.telemetry.batteryLevel ?? 100) < 20
  ).length;
  const maintenance = cartAssets.filter((c) => c.status === 'maintenance').length;

  const columns = cartColumns;

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <ShoppingCart className="w-4 h-4" /> Módulo Prioritário Operacional
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gestão & Telemetria de Carrinhos de Supermercado
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Prevenção de evasão de patrimônio, gestão de bateria BLE, zonas da loja e perímetro.
          </p>
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border shrink-0 ${
            showMap
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
        </button>
      </div>

      {showMap && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <LiveMap
            assetsList={cartAssets}
            heightClass="h-[420px]"
            specializedTitle="Carrinhos de Supermercado"
            showClustering={cartAssets.length > 25}
          />
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Carrinhos"
          value={totalCarts}
          icon={ShoppingCart}
          variant="cyan"
          subtext="Frota ativa na unidade"
        />
        <StatCard
          title="Dentro da Unidade"
          value={insideUnit}
          icon={CheckCircle2}
          variant="emerald"
          subtext="No perímetro autorizado"
        />
        <StatCard
          title="Fora da Unidade"
          value={outsideUnit}
          icon={ShieldAlert}
          variant="rose"
          subtext="Alerta de evasão na via"
        />
        <StatCard
          title="Sem Comunicação"
          value={noComm}
          icon={Radio}
          variant="slate"
          subtext="Sinal ausente ou offline"
        />
        <StatCard
          title="Bateria Baixa"
          value={lowBat}
          icon={BatteryLow}
          variant="amber"
          subtext="&lt; 15% requer troca"
        />
        <StatCard
          title="Em Manutenção"
          value={maintenance}
          icon={Wrench}
          variant="indigo"
          subtext="Oficina de rodízios"
        />
      </div>

      {/* Carts Data Table */}
      <DataTable
        title="Listagem Geral de Carrinhos"
        data={cartAssets}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Buscar por patrimônio, tag BLE ou loja..."
        onRowClick={(item) => setSelectedAsset(item)}
        actions={(item) => (
          <button
            onClick={() => setRecoveringAsset(item)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/15 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            title="Registrar recuperação do carrinho"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        )}
      />

      {/* Histórico de Recuperações */}
      {cartRecoveries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            <span>Últimas Recuperações Registradas</span>
          </div>
          <div className="space-y-2">
            {cartRecoveries.slice(0, 5).map((rec) => (
              <div
                key={rec.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80"
              >
                {rec.photoDataUrl ? (
                  <img src={rec.photoDataUrl} alt="Evidência" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                    <Camera className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs">{rec.assetCode}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">{rec.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Recuperado por <strong className="text-slate-700 dark:text-slate-200">{rec.recoveredBy}</strong>
                    {rec.notes && <span> — {rec.notes}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecoveryFormModal
        isOpen={!!recoveringAsset}
        onClose={() => setRecoveringAsset(null)}
        asset={recoveringAsset}
        defaultRecoveredBy={user?.name}
        onSave={(recovery) => {
          if (recoveringAsset) {
            recoverAsset(recoveringAsset.id, recovery);
          }
          setRecoveringAsset(null);
        }}
      />
    </div>
  );
};
