import React, { useState } from 'react';
import {
  ShieldAlert,
  MapPin,
  UserX,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Navigation,
  Building2,
  Map as MapIcon,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { RecoveryCaseFormModal } from '../components/common/RecoveryCaseFormModal';
import { GreylistEntryFormModal } from '../components/common/GreylistEntryFormModal';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetRecoveryCase, RecoveryCaseStatus } from '../types';

const CASE_STATUS_BADGE: Record<RecoveryCaseStatus, string> = {
  aberto: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  em_negociacao: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  localizado: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  recuperado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  encerrado: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700',
};

const CASE_STATUS_LABEL: Record<RecoveryCaseStatus, string> = {
  aberto: 'Aberto',
  em_negociacao: 'Em Negociação',
  localizado: 'Localizado',
  recuperado: 'Recuperado',
  encerrado: 'Encerrado',
};

const GREYLIST_TYPE_LABEL: Record<string, string> = {
  endereco: 'Endereço Suspeito',
  local_penhora: 'Local de Penhora/Desmanche',
  pessoa: 'Pessoa com Restrição',
};

export const AssetRecoveryModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const {
    getFilteredAssets,
    geofences,
    recoveryCases,
    addRecoveryCase,
    updateRecoveryCase,
    greylist,
    addGreylistEntry,
    deleteGreylistEntry,
  } = useAssets();

  const [activeSubTab, setActiveSubTab] = useState<'casos' | 'zonas' | 'greylist'>('casos');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<AssetRecoveryCase | null>(null);
  const [isGreylistModalOpen, setIsGreylistModalOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const assets = getFilteredAssets(selectedClientId, selectedUnitId);
  const riskZones = geofences.filter((g) => g.isHighRiskZone);

  const openCases = recoveryCases.filter((c) => c.status === 'aberto' || c.status === 'em_negociacao');
  const locatedCases = recoveryCases.filter((c) => c.status === 'localizado');
  const recoveredCases = recoveryCases.filter((c) => c.status === 'recuperado');

  const handleSaveCase = (recoveryCase: AssetRecoveryCase) => {
    if (editingCase) {
      updateRecoveryCase(editingCase.id, recoveryCase);
    } else {
      addRecoveryCase(recoveryCase);
    }
    setIsCaseModalOpen(false);
    setEditingCase(null);
  };

  const caseColumns: Column<AssetRecoveryCase>[] = [
    {
      header: 'Ativo / Placa',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{row.plateNumber || row.assetCode}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.assetName}</div>
        </div>
      ),
    },
    {
      header: 'Motivo',
      accessor: (row) => <span className="text-slate-600 dark:text-slate-300">{row.reason}</span>,
    },
    {
      header: 'Responsável',
      accessor: (row) => <span className="text-slate-600 dark:text-slate-300">{row.responsibleName}</span>,
    },
    {
      header: 'Locais Frequentes',
      accessor: (row) =>
        row.frequentStopPoints.length > 0 ? (
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-rose-500" /> {row.frequentStopPoints.length} local(is)
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${CASE_STATUS_BADGE[row.status]}`}>
          {CASE_STATUS_LABEL[row.status]}
        </span>
      ),
    },
    {
      header: 'Aberto em',
      accessor: (row) => <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{row.openedAt}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-rose-600 dark:text-rose-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <ShieldAlert className="w-4 h-4" /> Cobrança &amp; Recuperação de Ativos
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Casos de Recuperação, Zonas de Risco &amp; Greylist
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitoramento de ativos com inadimplência/furto, zonas de alto risco e locais/pessoas sinalizados como
            risco de retenção.
          </p>
        </div>

        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs shadow-sm">
          <button
            onClick={() => setActiveSubTab('casos')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'casos' ? 'bg-rose-500 text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Casos ({recoveryCases.length})
          </button>
          <button
            onClick={() => setActiveSubTab('zonas')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'zonas' ? 'bg-rose-500 text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Zonas de Risco ({riskZones.length})
          </button>
          <button
            onClick={() => setActiveSubTab('greylist')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'greylist' ? 'bg-rose-500 text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Greylist ({greylist.length})
          </button>
        </div>
      </div>

      {/* ===================== CASOS ===================== */}
      {activeSubTab === 'casos' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Casos Ativos" value={openCases.length} icon={ShieldAlert} variant="amber" />
            <StatCard title="Localizados" value={locatedCases.length} icon={Navigation} variant="indigo" />
            <StatCard title="Recuperados" value={recoveredCases.length} icon={CheckCircle2} variant="emerald" />
            <StatCard title="Total de Casos" value={recoveryCases.length} icon={UserX} variant="rose" />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowMap(!showMap)}
              className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border ${
                showMap
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
            </button>
            <button
              onClick={() => {
                setEditingCase(null);
                setIsCaseModalOpen(true);
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-rose-600/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Caso</span>
            </button>
          </div>

          {showMap && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
              <LiveMap
                assetsList={assets.filter((a) => recoveryCases.some((c) => c.assetId === a.id))}
                heightClass="h-[420px]"
                specializedTitle="Ativos em Recuperação"
                showClustering={false}
              />
            </div>
          )}

          <DataTable
            title="Casos de Recuperação de Ativos"
            data={recoveryCases}
            columns={caseColumns}
            keyExtractor={(item) => item.id}
            actions={(item) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditingCase(item);
                    setIsCaseModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  title="Editar caso"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* ===================== ZONAS DE RISCO ===================== */}
      {activeSubTab === 'zonas' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Zonas de Alto Risco Cadastradas
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Zonas de alto risco (pátios de penhor/desmanche, áreas de recolhimento) são desenhadas no editor de
            cercas virtuais — marque a opção "Zona de Alto Risco" ao criar ou editar uma cerca em{' '}
            <strong className="text-slate-700 dark:text-slate-300">Cercas Virtuais</strong>.
          </p>

          {riskZones.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-xs">
              Nenhuma zona de alto risco cadastrada ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {riskZones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-3.5 bg-rose-500/5 border border-rose-500/30 rounded-xl space-y-1.5"
                >
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate">{zone.name}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {zone.type === 'circle' ? `Raio de ${zone.radius}m` : `Polígono (${zone.coordinates.length} vértices)`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== GREYLIST ===================== */}
      {activeSubTab === 'greylist' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setIsGreylistModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-rose-600/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Item de Greylist</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {greylist.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 dark:text-slate-600">
                Nenhum item na greylist.
              </div>
            ) : (
              greylist.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                      <Building2 className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="truncate">{entry.label}</span>
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remover "${entry.label}" da greylist?`)) deleteGreylistEntry(entry.id);
                      }}
                      className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded">
                    {GREYLIST_TYPE_LABEL[entry.type]}
                  </span>
                  {entry.description && <p className="text-slate-500 dark:text-slate-400 text-[11px]">{entry.description}</p>}
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-mono">Adicionado em {entry.addedAt}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <RecoveryCaseFormModal
        isOpen={isCaseModalOpen}
        onClose={() => {
          setIsCaseModalOpen(false);
          setEditingCase(null);
        }}
        onSave={handleSaveCase}
        editingCase={editingCase}
        assets={assets}
      />

      <GreylistEntryFormModal
        isOpen={isGreylistModalOpen}
        onClose={() => setIsGreylistModalOpen(false)}
        onSave={(entry) => {
          addGreylistEntry(entry);
          setIsGreylistModalOpen(false);
        }}
        clientId={selectedClientId === 'all' ? 'cli_1' : selectedClientId}
      />
    </div>
  );
};
