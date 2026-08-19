import React, { useState } from 'react';
import {
  Sprout,
  PawPrint,
  Fence,
  Map as MapIcon,
  Battery,
  BatteryWarning,
  BatteryLow,
  BatteryFull,
  WifiOff,
  Radio,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Gauge,
  Server,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice, Animal, AlertSeverity } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';
import { AnimalFormModal } from '../components/common/AnimalFormModal';

const TRACKING_PROFILES: { value: NonNullable<AssetDevice['trackingProfile']>; label: string; hint: string }[] = [
  { value: 'economy', label: 'Economia', hint: 'Intervalos longos — prioriza autonomia da bateria' },
  { value: 'normal', label: 'Normal', hint: 'Equilíbrio entre autonomia e frequência de atualização' },
  { value: 'intensive', label: 'Intensivo', hint: 'Atualizações frequentes — usar durante manejo/transporte' },
  { value: 'emergency', label: 'Emergência', hint: 'Frequência máxima — usar quando o animal sai da área autorizada' },
];

const ALERT_SEVERITY_STYLE: Record<AlertSeverity, { card: string; icon: string }> = {
  critical: {
    card: 'bg-white dark:bg-slate-900/70 border-rose-200 dark:border-rose-500/20',
    icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/25',
  },
  warning: {
    card: 'bg-white dark:bg-slate-900/70 border-amber-200 dark:border-amber-500/20',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/25',
  },
  info: {
    card: 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800/80',
    icon: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/25',
  },
};

export const AgroModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const {
    getFilteredAssets,
    getFilteredAnimals,
    geofences,
    alerts,
    acknowledgeAlert,
    selectedAsset,
    setSelectedAsset,
    updateAsset,
    addAnimal,
    updateAnimal,
    deleteAnimal,
  } = useAssets();
  const [showMap, setShowMap] = useState(true);
  const [animalModalOpen, setAnimalModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  // Servidor de apontamento das coleiras Agro (comando SMS adminip123456 <host> <porta>#
  // do dispositivo, ver docs/integrations/F30_GPSONE.md). Escopo isolado ao módulo Agro —
  // guardado só no navegador (localStorage), não mexe no endpoint global de homologação
  // GT06 (/homologacao) nem em nenhum outro módulo.
  const [collarServerHost, setCollarServerHost] = useState(
    () => localStorage.getItem('athos_agro_collar_server_host') || '111.230.99.90',
  );
  const [collarServerPort, setCollarServerPort] = useState(
    () => localStorage.getItem('athos_agro_collar_server_port') || '7700',
  );
  const saveCollarServer = (host: string, port: string) => {
    setCollarServerHost(host);
    setCollarServerPort(port);
    localStorage.setItem('athos_agro_collar_server_host', host);
    localStorage.setItem('athos_agro_collar_server_port', port);
  };

  const agroAssets = getFilteredAssets(selectedClientId, selectedUnitId).filter((a) => a.category === 'agro');
  const agroAnimals = getFilteredAnimals(selectedClientId, selectedUnitId);
  const agroGeofences = geofences.filter((g) => g.targetCategory === 'agro' || g.targetCategory === 'all');
  const agroAlerts = alerts.filter((a) => a.category === 'agro');

  const collarCount = agroAssets.filter((a) => a.subcategory !== 'tractor').length;
  const monitoredPastures = new Set(agroGeofences.map((g) => g.id)).size;
  const criticalAlertsCount = agroAlerts.filter((a) => !a.acknowledged && a.severity === 'critical').length;

  // Energia das Coleiras: "Sem comunicação" sempre que o device está offline —
  // não confiar no último % de bateria reportado nesse caso, pode estar
  // desatualizado. Faixas seguem a mesma disciplina de "nunca inventar %"
  // documentada em docs/integrations/BRGPS.md — aqui o % vem direto de
  // telemetry.batteryLevel (já real no tipo do app).
  const batteryBuckets = { normal: 0, attention: 0, low: 0, critical: 0, offline: 0 };
  agroAssets.forEach((d) => {
    if (d.status === 'offline') batteryBuckets.offline++;
    else if (d.telemetry.batteryLevel >= 60) batteryBuckets.normal++;
    else if (d.telemetry.batteryLevel >= 30) batteryBuckets.attention++;
    else if (d.telemetry.batteryLevel >= 15) batteryBuckets.low++;
    else batteryBuckets.critical++;
  });

  // Animais por pasto — a partir do campo denormalizado Animal.currentGeofenceName.
  // Esse campo é preenchido pelo motor de geofence do conector (fora de escopo
  // nesta fase); enquanto não houver conector rodando, aparece como "Sem cerca
  // atribuída" para todo mundo — não é um bug, é honestidade sobre o que ainda
  // não está ligado a hardware real.
  const byPasture = new Map<string, number>();
  agroAnimals.forEach((a) => {
    const key = a.currentGeofenceName || 'Sem cerca atribuída';
    byPasture.set(key, (byPasture.get(key) || 0) + 1);
  });

  const selectedAnimal = selectedAsset
    ? agroAnimals.find((a) => a.assignedDeviceId === selectedAsset.id) || null
    : null;

  const handleSaveAnimal = (animal: Animal) => {
    if (editingAnimal) updateAnimal(animal.id, animal);
    else addAnimal(animal);
    setAnimalModalOpen(false);
    setEditingAnimal(null);
  };

  const animalColumns: Column<Animal>[] = [
    {
      header: 'Animal',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-lime-500/10 border border-lime-500/30 text-lime-600 dark:text-lime-400">
              <PawPrint className="w-4 h-4" />
            </div>
            <span>{row.name || row.athosTagCode}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {row.athosTagCode} {row.earTagId ? `· Brinco ${row.earTagId}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Espécie / Lote',
      accessor: (row) => (
        <span className="text-slate-700 dark:text-slate-200 text-xs capitalize">
          {row.species}
          {row.batchName ? ` · ${row.batchName}` : ''}
        </span>
      ),
    },
    {
      header: 'Coleira Vinculada',
      accessor: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 text-xs">
          {row.assignedDeviceCode || 'Sem coleira'}
        </span>
      ),
    },
    {
      header: 'Pasto Atual',
      accessor: (row) => (
        <span className="text-[10px] text-lime-600 dark:text-lime-400 font-mono">
          {row.currentGeofenceName || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
          {row.status}
        </span>
      ),
    },
    {
      header: 'Ações',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingAnimal(row);
              setAnimalModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-500/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remover o animal ${row.name || row.athosTagCode}?`)) deleteAnimal(row.id);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-lime-600 dark:text-lime-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Sprout className="w-4 h-4" /> ATHOS AGRO TRACK
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gestão Inteligente de Pastagens, Rebanhos e Cercas Virtuais
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Rastreamento por coleira (GPS + BDS + LBS) com cerca virtual de advertência e cerca de limite
            crítico. Configuração de leitura em tempo real do conector do fabricante ainda pendente — dados
            de posição hoje vêm do cadastro manual de dispositivos.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setEditingAnimal(null);
              setAnimalModalOpen(true);
            }}
            className="px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border bg-lime-600 text-white border-lime-600"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Animal</span>
          </button>
          <button
            onClick={() => setShowMap(!showMap)}
            className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border ${
              showMap
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Animais no Rebanho" value={String(agroAnimals.length)} icon={PawPrint} variant="emerald" />
        <StatCard title="Coleiras Ativas" value={String(collarCount)} icon={Radio} variant="cyan" />
        <StatCard title="Cercas Virtuais" value={String(monitoredPastures)} icon={Fence} variant="amber" />
        <StatCard title="Alertas Críticos" value={String(criticalAlertsCount)} icon={ShieldAlert} variant="rose" />
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-3">
          <Server className="w-3.5 h-3.5 text-lime-500" /> Servidor de Apontamento — Coleiras Agro
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3">
          Endereço exclusivo deste módulo, usado para apontar as coleiras físicas (comando SMS{' '}
          <code className="font-mono">adminip123456 &lt;host&gt; &lt;porta&gt;#</code>). Configuração salva só
          neste navegador — não altera o endpoint global de homologação GT06 nem nenhum outro módulo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[10px] uppercase font-mono">Host / IP</span>
            <input
              className="rounded-lg border px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              value={collarServerHost}
              onChange={(e) => saveCollarServer(e.target.value, collarServerPort)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[10px] uppercase font-mono">Porta</span>
            <input
              className="rounded-lg border px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              value={collarServerPort}
              onChange={(e) => saveCollarServer(collarServerHost, e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <code className="text-[11px] font-mono text-lime-600 dark:text-lime-400 truncate">
            adminip123456 {collarServerHost} {collarServerPort}#
          </code>
        </div>
      </div>

      {showMap && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4 px-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-500" /> Cerca Virtual 1 — Zona de Advertência (interna)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Cerca Virtual 2 — Limite Crítico (externa)
            </span>
            <span className="text-slate-400 dark:text-slate-600">
              {agroGeofences.length === 0
                ? 'Nenhuma cerca cadastrada ainda — crie em "Cercas Virtuais" no menu, categoria Agro.'
                : `${agroGeofences.length} cerca(s) configurada(s) para este rebanho.`}
            </span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <LiveMap
              assetsList={agroAssets}
              geofencesList={agroGeofences}
              heightClass="h-[480px]"
              specializedTitle="ATHOS AGRO TRACK"
              showClustering={false}
              onSelectAsset={(a) => setSelectedAsset(a)}
            />
          </div>
        </div>
      )}

      {selectedAsset && selectedAsset.category === 'agro' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-600 dark:text-lime-400">
              <AssetIcon category="agro" subcategory={selectedAsset.subcategory} className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedAnimal?.name || selectedAnimal?.athosTagCode || selectedAsset.name}
              </h3>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                Coleira {selectedAsset.code} · IMEI {selectedAsset.imei}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500">Localização</div>
              <div className="font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                {selectedAsset.telemetry.latitude.toFixed(5)}, {selectedAsset.telemetry.longitude.toFixed(5)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500">Status</div>
              <div className="font-mono text-slate-700 dark:text-slate-200 mt-0.5 capitalize">
                {selectedAsset.status}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500">Bateria</div>
              <div className="font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                {selectedAsset.status === 'offline' ? 'Sem comunicação' : `${selectedAsset.telemetry.batteryLevel}%`}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500">Pasto Atual</div>
              <div className="font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                {selectedAnimal?.currentGeofenceName || '—'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-2">
              <Gauge className="w-3.5 h-3.5 text-cyan-500" /> Perfil de Frequência de Rastreamento
            </div>
            <div className="flex flex-wrap gap-2">
              {TRACKING_PROFILES.map((p) => (
                <button
                  key={p.value}
                  title={p.hint}
                  onClick={() => updateAsset(selectedAsset.id, { trackingProfile: p.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    selectedAsset.trackingProfile === p.value
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
              Preferência salva no cadastro do dispositivo. Aplicar de fato no hardware depende do canal de
              comando do conector do fabricante (ainda não implementado neste projeto).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-3">
            <Battery className="w-3.5 h-3.5 text-emerald-500" /> Energia das Coleiras
          </div>
          <div className="space-y-2">
            {[
              { label: 'Normal', count: batteryBuckets.normal, icon: BatteryFull, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Atenção', count: batteryBuckets.attention, icon: Battery, color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Bateria Baixa', count: batteryBuckets.low, icon: BatteryLow, color: 'text-orange-600 dark:text-orange-400' },
              { label: 'Crítica', count: batteryBuckets.critical, icon: BatteryWarning, color: 'text-rose-600 dark:text-rose-400' },
              { label: 'Sem Comunicação', count: batteryBuckets.offline, icon: WifiOff, color: 'text-slate-400 dark:text-slate-500' },
            ].map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs py-1.5">
                <span className={`flex items-center gap-2 ${b.color}`}>
                  <b.icon className="w-4 h-4" /> {b.label}
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{b.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-3">
            <Fence className="w-3.5 h-3.5 text-lime-500" /> Animais por Pasto
          </div>
          <div className="space-y-2">
            {byPasture.size === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum animal cadastrado ainda.</p>
            )}
            {Array.from(byPasture.entries()).map(([pasture, count]) => (
              <div key={pasture} className="flex items-center justify-between text-xs py-1.5">
                <span className="text-slate-600 dark:text-slate-300">{pasture}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            Densidade e tempo médio de permanência por pasto dependem do histórico real de GPS do conector
            (fora de escopo nesta fase — ver docs/integrations/F30_GPSONE.md).
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Central de Alertas — Agro
        </div>
        {agroAlerts.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum alerta registrado para o rebanho.</p>
        )}
        <div className="space-y-2">
          {agroAlerts.slice(0, 8).map((alt) => {
            const style = ALERT_SEVERITY_STYLE[alt.severity];
            return (
              <div
                key={alt.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${style.card}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg shrink-0 ${style.icon}`}>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{alt.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {alt.assetName} · {alt.timestamp}
                    </div>
                  </div>
                </div>
                {!alt.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alt.id)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Reconhecer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <DataTable
        title="Rebanho Cadastrado"
        data={agroAnimals}
        columns={animalColumns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => {
          setEditingAnimal(item);
          setAnimalModalOpen(true);
        }}
      />

      <AnimalFormModal
        isOpen={animalModalOpen}
        onClose={() => {
          setAnimalModalOpen(false);
          setEditingAnimal(null);
        }}
        onSave={handleSaveAnimal}
        editingAnimal={editingAnimal}
      />
    </div>
  );
};
