import React, { useState } from 'react';
import { ShieldCheck, X, Pencil, Save, CheckCircle2 } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { HomologationAdminProvider, useHomologationAdmin } from '../../context/HomologationAdminContext';
import {
  HomologationRequest,
  HomologationStatus,
  HomologationProtocol,
  HomologationTransport,
} from '../../types/homologation';

const STATUS_LABEL: Record<HomologationStatus, string> = {
  pending_review: 'Aguardando Revisão',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
};

const STATUS_COLOR: Record<HomologationStatus, string> = {
  pending_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  in_progress: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

const PROTOCOL_OPTIONS: HomologationProtocol[] = [
  'GT06', 'GT06N', 'GT06E', 'H02', 'JT/T808', 'TK103', 'Protocolo proprietário', 'Outro',
];
const TRANSPORT_OPTIONS: HomologationTransport[] = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'MQTT', 'Outro'];

interface EditableFields {
  testImei: string;
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  protocol: HomologationProtocol;
  transport: HomologationTransport;
}

const fieldsFromRequest = (r: HomologationRequest): EditableFields => ({
  testImei: r.testImei,
  manufacturer: r.manufacturer,
  model: r.model,
  firmwareVersion: r.firmwareVersion ?? '',
  protocol: r.protocol,
  transport: r.transport,
});

const HomologationAdminContent: React.FC = () => {
  const { requests, events, reports, isLoading, updateRequestStatus, updateRequestNotes, updateRequestFields } =
    useHomologationAdmin();
  const [selected, setSelected] = useState<HomologationRequest | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [fieldsDraft, setFieldsDraft] = useState<EditableFields | null>(null);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const openDetail = (row: HomologationRequest) => {
    setSelected(row);
    setNotesDraft(row.adminNotes ?? '');
    setIsEditingFields(false);
    setFieldsDraft(fieldsFromRequest(row));
    setSavedFlash(false);
  };

  const handleSaveFields = async () => {
    if (!selected || !fieldsDraft) return;
    setIsSavingFields(true);
    const ok = await updateRequestFields(selected.id, fieldsDraft);
    setIsSavingFields(false);
    if (!ok) return;
    setSelected({ ...selected, ...fieldsDraft });
    setIsEditingFields(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const packetsFor = (requestId: string) => events.filter((e) => e.requestId === requestId).length;
  const lastConnectionFor = (requestId: string) => {
    const requestEvents = events.filter((e) => e.requestId === requestId);
    if (requestEvents.length === 0) return '—';
    return new Date(requestEvents[0].createdAt).toLocaleString('pt-BR');
  };
  const resultFor = (requestId: string) => reports.find((r) => r.requestId === requestId)?.result ?? '—';

  const columns: Column<HomologationRequest>[] = [
    {
      header: 'Fornecedor',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{row.companyLegalName}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.technicalContactEmail}</div>
        </div>
      ),
    },
    {
      header: 'Equipamento',
      accessor: (row) => (
        <div>
          <div className="text-slate-800 dark:text-slate-200">{row.manufacturer} — {row.model}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">FW {row.firmwareVersion || 'n/d'}</div>
        </div>
      ),
    },
    {
      header: 'Protocolo',
      accessor: (row) => (
        <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg uppercase">
          {row.protocol} / {row.transport}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border uppercase ${STATUS_COLOR[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      ),
    },
    { header: 'Última Conexão', accessor: (row) => lastConnectionFor(row.id) },
    { header: 'Pacotes Recebidos', accessor: (row) => packetsFor(row.id) },
    {
      header: 'Resultado',
      accessor: (row) => {
        const result = resultFor(row.id);
        return (
          <span
            className={`text-[10px] font-bold font-mono uppercase ${
              result === 'COMPATIVEL'
                ? 'text-emerald-600 dark:text-emerald-400'
                : result === 'PENDENTE'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {result}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Área Administrativa ATHOS
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Homologação de Dispositivos — GT06
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Solicitações recebidas pelo portal público de homologação (/homologacao), fabricantes, IMEIs de teste e resultado por protocolo.
          </p>
        </div>
      </div>

      <DataTable
        title="Solicitações de Homologação"
        data={requests}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={openDetail}
        searchPlaceholder="Buscar por fornecedor, fabricante, modelo..."
      />

      {isLoading && (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">Carregando homologações...</p>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{selected.companyLegalName}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="space-y-2 text-xs">
              <Row label="Responsável Técnico" value={`${selected.technicalContactName} (${selected.technicalContactEmail}, ${selected.technicalContactPhone})`} />
            </dl>

            {/* Identificação, IMEI e protocolo — editáveis pela equipe ATHOS após revisão */}
            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                  Identificação, Tag ID &amp; Protocolo
                </span>
                {!isEditingFields && (
                  savedFlash ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Salvo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingFields(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  )
                )}
              </div>

              {isEditingFields && fieldsDraft ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Fabricante</label>
                      <input
                        value={fieldsDraft.manufacturer}
                        onChange={(e) => setFieldsDraft({ ...fieldsDraft, manufacturer: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Modelo</label>
                      <input
                        value={fieldsDraft.model}
                        onChange={(e) => setFieldsDraft({ ...fieldsDraft, model: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Firmware</label>
                    <input
                      value={fieldsDraft.firmwareVersion}
                      onChange={(e) => setFieldsDraft({ ...fieldsDraft, firmwareVersion: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">IMEI de Teste (Tag ID)</label>
                    <input
                      value={fieldsDraft.testImei}
                      onChange={(e) => setFieldsDraft({ ...fieldsDraft, testImei: e.target.value.replace(/[^\d]/g, '') })}
                      inputMode="numeric"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500/60"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Protocolo</label>
                      <select
                        value={fieldsDraft.protocol}
                        onChange={(e) => setFieldsDraft({ ...fieldsDraft, protocol: e.target.value as HomologationProtocol })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500/60"
                      >
                        {PROTOCOL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Transporte</label>
                      <select
                        value={fieldsDraft.transport}
                        onChange={(e) => setFieldsDraft({ ...fieldsDraft, transport: e.target.value as HomologationTransport })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500/60"
                      >
                        {TRANSPORT_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveFields}
                      disabled={isSavingFields}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingFields ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFieldsDraft(fieldsFromRequest(selected));
                        setIsEditingFields(false);
                      }}
                      disabled={isSavingFields}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <dl className="space-y-2">
                  <Row label="Fabricante / Modelo" value={`${selected.manufacturer} / ${selected.model}`} />
                  <Row label="Firmware" value={selected.firmwareVersion || 'n/d'} />
                  <Row label="IMEI de Teste (Tag ID)" value={selected.testImei} />
                  <Row label="Protocolo / Transporte" value={`${selected.protocol} / ${selected.transport}`} />
                </dl>
              )}
            </div>

            <dl className="space-y-2 text-xs mt-4">
              <Row label="Quantidade Estimada" value={String(selected.estimatedDeviceCount ?? 'n/d')} />
              <Row label="Manual" value={selected.manualUrl || '—'} />
              <Row label="Documentação do Protocolo" value={selected.protocolDocUrl || '—'} />
              <Row label="Tabela de Comandos" value={selected.commandTableUrl || '—'} />
              <Row label="Exemplo de Payload" value={selected.payloadSampleText || '—'} />
              <Row label="Transmite para 3ºs" value={selected.canTransmitToThirdPartyServer ? 'Sim' : 'Não'} />
              <Row label="API do Fabricante" value={selected.hasManufacturerApi ? (selected.manufacturerApiType || 'Sim') : 'Não'} />
              <Row label="Espelhamento/Forwarding" value={selected.hasForwardingMirroring ? (selected.forwardingDescription || 'Sim') : 'Não'} />
            </dl>

            <div className="mt-5 space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Status</label>
              <select
                value={selected.status}
                onChange={(e) => {
                  const status = e.target.value as HomologationStatus;
                  updateRequestStatus(selected.id, status);
                  setSelected({ ...selected, status });
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Observações Internas</label>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => updateRequestNotes(selected.id, notesDraft)}
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
                placeholder="Notas da equipe ATHOS sobre esta homologação..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
    <dt className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">{label}</dt>
    <dd className="text-slate-700 dark:text-slate-300 break-words">{value}</dd>
  </div>
);

export const HomologationAdminPage: React.FC = () => (
  <HomologationAdminProvider>
    <HomologationAdminContent />
  </HomologationAdminProvider>
);
