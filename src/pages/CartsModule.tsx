import React, { useState } from 'react';
import { ShoppingCart, AlertCircle, BatteryLow, ShieldAlert, Wrench, Radio, MapPin, CheckCircle2, Map as MapIcon, ShieldCheck, Camera } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { RecoveryFormModal } from '../components/common/RecoveryFormModal';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const CartsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId, user } = useAuth();
  const { getFilteredAssets, setSelectedAsset, recoveries, recoverAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);
  const [recoveringAsset, setRecoveringAsset] = useState<AssetDevice | null>(null);

  const allAssets = getFilteredAssets(selectedClientId, selectedUnitId);
  const cartAssets = allAssets.filter((a) => a.category === 'cart');
  const cartAssetIds = new Set(cartAssets.map((c) => c.id));
  const cartRecoveries = recoveries.filter((r) => cartAssetIds.has(r.assetId));

  // Realism supermarket numbers
  const totalCartsSimulated = 250;
  const insideUnit = 242;
  const outsideUnit = 3;
  const noComm = 5;
  const lowBat = 10;
  const maintenance = 8;

  const columns: Column<AssetDevice>[] = [
    {
      header: 'ID / Patrimônio',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <AssetIcon category="cart" subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.code}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{row.name}</div>
        </div>
      ),
    },
    {
      header: 'Unidade',
      accessor: 'unitName',
    },
    {
      header: 'Tag BLE / IMEI',
      accessor: (row) => (
        <span className="font-mono text-cyan-400 text-[11px]">{row.imei}</span>
      ),
    },
    {
      header: 'Status Perímetro',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase ${
            row.status === 'out_of_geofence'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : row.status === 'low_battery'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {row.status === 'out_of_geofence'
            ? 'Fora da Loja'
            : row.status === 'low_battery'
            ? 'Bateria Baixa'
            : 'Dentro do Perímetro'}
        </span>
      ),
    },
    {
      header: 'Bateria',
      accessor: (row) => (
        <span
          className={`font-mono font-bold ${
            row.telemetry.batteryLevel < 20 ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {row.telemetry.batteryLevel}%
        </span>
      ),
    },
    {
      header: 'Última Localização',
      accessor: (row) => (
        <div className="text-[11px] text-slate-300 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span>{row.geofenceName || 'Estacionamento Norte'}</span>
        </div>
      ),
    },
    {
      header: 'Última Comunicação',
      accessor: (row) => <span className="font-mono text-slate-400">{row.telemetry.lastCommunication}</span>,
    },
  ];

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
          value={totalCartsSimulated}
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

      {/* 3 Níveis de Cerca Virtual no Perímetro do Supermercado */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4 text-emerald-500" />
              <span>Proteção Ativa em 3 Níveis de Perímetro</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Perímetro Inteligente de Cerca Virtual do Supermercado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Controle automático por Gateways BLE com disparo de alertas e travamento de roda por RF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              RF Auto-Lock Pronto
            </span>
          </div>
        </div>

        {/* 3 Perimeter Level Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Level 1 Card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold rounded-lg border border-emerald-500/30">
                NÍVEL 1 • RAIO 65M
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">145 Carrinhos</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Zona Interna (Salão & Caixas)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Área operacional segura. Carrinhos em uso normal pelos clientes dentro da loja.
              </p>
            </div>
            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Status: Seguros</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Sinal BLE 100%</span>
            </div>
          </div>

          {/* Level 2 Card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold rounded-lg border border-amber-500/30">
                NÍVEL 2 • RAIO 130M
              </span>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">62 Carrinhos</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Zona Periférica (Estacionamento)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Área de alerta preventivo. Monitoramento no estacionamento e marquises externas.
              </p>
            </div>
            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Status: Alerta Amarelo</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">Notificação Ativa</span>
            </div>
          </div>

          {/* Level 3 Card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-bold rounded-lg border border-rose-500/30">
                NÍVEL 3 • RAIO 220M
              </span>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">3 Carrinhos</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                Limite Externo (Rua / Evasão)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Zona crítica de evasão. Trava magnética de roda RF acionada e aviso à segurança.
              </p>
            </div>
            <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Status: Roda Travada RF</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">Evasão Bloqueada</span>
            </div>
          </div>
        </div>
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
