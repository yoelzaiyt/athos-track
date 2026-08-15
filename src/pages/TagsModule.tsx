import React, { useState } from 'react';
import { Tag, Cpu, Radio, Wifi, CheckCircle2, Plus, Pencil, Trash2, Map as MapIcon, Satellite, Link2 } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { DeviceFormModal } from '../components/common/DeviceFormModal';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';

const PROVIDER_HEALTH_LABEL: Record<string, { label: string; className: string }> = {
  HEALTHY: { label: 'Operante', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  DEGRADED: { label: 'Degradado', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  UNAVAILABLE: { label: 'Indisponível', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
};

const UnassignedBrgpsDevicesPanel: React.FC = () => {
  const { providerDevices, providerHealth, assets, linkProviderDeviceToAsset } = useAssets();
  const [selectedAssetByDevice, setSelectedAssetByDevice] = useState<Record<string, string>>({});

  const unassigned = providerDevices.filter((d) => d.provider === 'BRGPS' && d.status === 'UNASSIGNED');
  const linkableAssets = assets.filter((a) => !a.provider);

  if (unassigned.length === 0 && !providerHealth) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
          <Satellite className="w-4 h-4" />
          <span>Dispositivos BRGPS Descobertos (Provider Real)</span>
        </div>
        {providerHealth && (
          <span
            className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-full uppercase border ${PROVIDER_HEALTH_LABEL[providerHealth.status]?.className}`}
          >
            Provider BRGPS: {PROVIDER_HEALTH_LABEL[providerHealth.status]?.label ?? providerHealth.status}
          </span>
        )}
      </div>

      {unassigned.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhum dispositivo BRGPS aguardando vinculação. Rode <code className="font-mono">npm run brgps:discover</code> para buscar novos.
        </p>
      ) : (
        <div className="space-y-2">
          {unassigned.map((device) => (
            <div
              key={device.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                  ID Externo: {device.externalDeviceId}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {device.isActived ? 'Ativado no fornecedor' : 'Não ativado no fornecedor'} · Descoberto em {new Date(device.discoveredAt).toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  value={selectedAssetByDevice[device.id] ?? ''}
                  onChange={(e) => setSelectedAssetByDevice((prev) => ({ ...prev, [device.id]: e.target.value }))}
                >
                  <option value="">Selecione um ativo…</option>
                  {linkableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!selectedAssetByDevice[device.id]}
                  onClick={() => {
                    const assetId = selectedAssetByDevice[device.id];
                    if (assetId) linkProviderDeviceToAsset(device.id, assetId);
                  }}
                  className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 shrink-0"
                >
                  <Link2 className="w-3 h-3" /> Vincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TagsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset, addAsset, updateAsset, deleteAsset } = useAssets();
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AssetDevice | null>(null);
  const [showMap, setShowMap] = useState(false);

  const allAssets = getFilteredAssets(selectedClientId, selectedUnitId);
  const filteredByProtocol = allAssets.filter((a) => {
    if (protocolFilter !== 'all' && a.protocol !== protocolFilter) return false;
    return true;
  });

  const activeCount = allAssets.filter((a) => a.status !== 'offline').length;
  const gt06Count = allAssets.filter((a) => a.protocol === 'GT06').length;
  const bleCount = allAssets.filter((a) => a.protocol === 'BLE Gateway').length;

  const handleNewDevice = () => {
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const handleEditDevice = (device: AssetDevice) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  };

  const handleDeleteDevice = (device: AssetDevice) => {
    if (window.confirm(`Remover o dispositivo "${device.name}" (${device.code})? Esta ação não pode ser desfeita.`)) {
      deleteAsset(device.id);
    }
  };

  const handleSaveDevice = (device: AssetDevice) => {
    if (editingDevice) {
      updateAsset(editingDevice.id, device);
    } else {
      addAsset(device);
    }
    setIsModalOpen(false);
    setEditingDevice(null);
  };

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Nome do Dispositivo',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 font-mono">
            <Tag className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">ID: {row.code}</div>
        </div>
      ),
    },
    {
      header: 'IMEI / Identificador',
      accessor: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold text-[11px]">{row.imei}</span>
      ),
    },
    {
      header: 'Protocolo de Comunicação',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 rounded">
          {row.protocol}
        </span>
      ),
    },
    {
      header: 'Ativo Associado',
      accessor: (row) => (
        <div className="text-slate-700 dark:text-slate-200 font-medium">{row.name}</div>
      ),
    },
    {
      header: 'Unidade Vinculada',
      accessor: 'unitName',
    },
    {
      header: 'Bateria',
      accessor: (row) => (
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{row.telemetry.batteryLevel}%</span>
      ),
    },
    {
      header: 'Serviço (Assinatura)',
      accessor: (row) => {
        if (!row.serviceExpireDate) return <span className="text-slate-400 dark:text-slate-600">—</span>;
        const expired = new Date(row.serviceExpireDate) < new Date();
        return (
          <span
            className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${
              expired
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}
          >
            {expired ? 'Vencido' : 'Ativo'} até {row.serviceExpireDate}
          </span>
        );
      },
    },
    {
      header: 'Último Ping',
      accessor: (row) => <span className="font-mono text-slate-500 dark:text-slate-400">{row.telemetry.lastCommunication}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Cpu className="w-4 h-4" /> Central Técnica de Telemetria
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Central de Tags, Dispositivos e Protocolos IoT
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cadastro e mapeamento de gateways BLE, rastreadores GT06, brokers MQTT e endpoints HTTP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Protocol Selector Pills */}
          <div className="flex flex-wrap items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs shadow-sm">
            {['all', 'GT06', 'Traccar Compatible', 'Wialon IPS', 'JT/T808', 'Suntech', 'Queclink', 'MQTT', 'HTTP', 'BLE Gateway', 'RFID', 'NFC', 'Custom'].map((p) => (
              <button
                key={p}
                onClick={() => setProtocolFilter(p)}
                className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold transition-colors ${
                  protocolFilter === p
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/40 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p === 'all' ? 'Todos Protocolos' : p}
              </button>
            ))}
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

          <button
            onClick={handleNewDevice}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-cyan-600/20 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Dispositivo</span>
          </button>
        </div>
      </div>

      {showMap && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <LiveMap
            assetsList={filteredByProtocol}
            heightClass="h-[420px]"
            specializedTitle="Tags e Dispositivos IoT"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total Tags / Dispositivos" value={allAssets.length} icon={Tag} variant="cyan" />
        <StatCard title="Dispositivos Ativos" value={activeCount} icon={CheckCircle2} variant="emerald" />
        <StatCard title="Protocolo GT06 GPS" value={gt06Count} icon={Radio} variant="amber" />
        <StatCard title="Gateways BLE" value={bleCount} icon={Wifi} variant="indigo" />
      </div>

      <UnassignedBrgpsDevicesPanel />

      <DataTable
        title="Dispositivos e Protocolos Configurados"
        data={filteredByProtocol}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAsset(item)}
        actions={(item) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => handleEditDevice(item)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              title="Editar dispositivo"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteDevice(item)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Remover dispositivo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      <DeviceFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDevice(null);
        }}
        onSave={handleSaveDevice}
        editingDevice={editingDevice}
      />
    </div>
  );
};
