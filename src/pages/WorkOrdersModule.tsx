import React, { useState } from 'react';
import {
  ClipboardList,
  Wrench,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  User,
  MapPinned,
  Image as ImageIcon,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { WorkOrderFormModal } from '../components/common/WorkOrderFormModal';
import { INSTALLATION_POINTS } from '../components/common/VehicleInstallDiagram';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { WorkOrder } from '../types';

const STATUS_BADGE: Record<WorkOrder['status'], string> = {
  pendente: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700',
  agendada: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  em_andamento: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  concluida: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cancelada: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const STATUS_LABEL: Record<WorkOrder['status'], string> = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const TYPE_LABEL: Record<WorkOrder['type'], string> = {
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  desinstalacao: 'Desinstalação',
  auditoria: 'Auditoria',
};

export const WorkOrdersModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, workOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder } = useAssets();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

  const vehicles = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'vehicle' || a.category === 'truck'
  );

  const pendingCount = workOrders.filter((o) => o.status === 'pendente' || o.status === 'agendada').length;
  const inProgressCount = workOrders.filter((o) => o.status === 'em_andamento').length;
  const completedCount = workOrders.filter((o) => o.status === 'concluida').length;
  const installCount = workOrders.filter((o) => o.type === 'instalacao').length;

  const handleSave = (order: WorkOrder) => {
    if (editingOrder) {
      updateWorkOrder(editingOrder.id, order);
    } else {
      addWorkOrder(order);
    }
    setIsModalOpen(false);
    setEditingOrder(null);
  };

  const columns: Column<WorkOrder>[] = [
    {
      header: 'OS / Tipo',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            {row.code}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{TYPE_LABEL[row.type]}</div>
        </div>
      ),
    },
    {
      header: 'Veículo',
      accessor: (row) => (
        <div>
          <div className="font-mono text-slate-800 dark:text-slate-200">{row.vehiclePlate || '—'}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.assetName}</div>
        </div>
      ),
    },
    {
      header: 'Técnico',
      accessor: (row) => (
        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
          <User className="w-3.5 h-3.5 text-indigo-500" /> {row.technicianName}
        </span>
      ),
    },
    {
      header: 'Ponto de Instalação',
      accessor: (row) => {
        const point = INSTALLATION_POINTS.find((p) => p.id === row.installPointId);
        if (!point) return <span className="text-slate-400 dark:text-slate-600">—</span>;
        return (
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <MapPinned className="w-3.5 h-3.5 text-amber-500" /> {point.label}
          </span>
        );
      },
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${STATUS_BADGE[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      ),
    },
    {
      header: 'Data',
      accessor: (row) => (
        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
          {row.completedDate ? `Concluída em ${row.completedDate}` : `Agendada para ${row.scheduledDate}`}
        </span>
      ),
    },
    {
      header: 'Foto',
      accessor: (row) =>
        row.installPhotoDataUrl ? (
          <ImageIcon className="w-4 h-4 text-emerald-500" />
        ) : (
          <span className="text-slate-300 dark:text-slate-700">—</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Wrench className="w-4 h-4" /> Operações de Campo
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Ordens de Serviço &amp; Gestão de Técnicos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dispatch de instalação/manutenção, diagrama de instalação na carroceria e evidência fotográfica.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingOrder(null);
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-cyan-600/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Ordem de Serviço</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Pendentes / Agendadas" value={pendingCount} icon={CalendarClock} variant="amber" />
        <StatCard title="Em Andamento" value={inProgressCount} icon={AlertTriangle} variant="cyan" />
        <StatCard title="Concluídas" value={completedCount} icon={CheckCircle2} variant="emerald" />
        <StatCard title="Instalações Registradas" value={installCount} icon={MapPinned} variant="indigo" />
      </div>

      <DataTable
        title="Ordens de Serviço"
        data={workOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        actions={(item) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                setEditingOrder(item);
                setIsModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              title="Editar ordem de serviço"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Remover a ordem de serviço "${item.code}"?`)) {
                  deleteWorkOrder(item.id);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Remover ordem de serviço"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      <WorkOrderFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        onSave={handleSave}
        editingOrder={editingOrder}
        vehicles={vehicles}
      />
    </div>
  );
};
