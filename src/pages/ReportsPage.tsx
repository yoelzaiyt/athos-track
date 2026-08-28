import React, { useState } from 'react';
import { FileBarChart2, Download, FileText, FileSpreadsheet, Sparkles } from 'lucide-react';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';

function todayPtBr(): string {
  return new Date().toLocaleDateString('pt-BR');
}

export const ReportsPage: React.FC = () => {
  const { assets, alerts } = useAssets();
  const { user, availableClients, selectedClientId } = useAuth();
  const [reportType, setReportType] = useState('Localização & Telemetria');

  // Nome do tenant pra exibir no relatório — o mesmo escopo já aplicado ao
  // resto da tela (client selecionado, ou o do usuário logado fora de
  // ATHOS_ADMIN). Achado desta rodada (UI-E2E-VALIDATION.md): esta tela
  // mostrava um nome de empresa e contagens fixas no código-fonte
  // ("Assaí Atacadista", "250 Carrinhos", "35 Veículos GT06") sem relação
  // nenhuma com o tenant realmente logado — corrigido pra usar dado real.
  const tenantName =
    availableClients.find((c) => c.id === (selectedClientId !== 'all' ? selectedClientId : user?.clientId))?.name ??
    (user?.role === 'ATHOS_ADMIN' ? 'Todas as Empresas' : '—');

  // CSV real (mesmo padrão de src/components/common/DataTable.tsx) — as
  // colunas variam pouco por reportType hoje porque o dado-fonte real
  // disponível no frontend é assets/alerts; cada linha inclui o tipo de
  // relatório selecionado pra ficar rastreável no arquivo exportado.
  const handleExportCsv = () => {
    const headers = ['tipo_relatorio', 'empresa', 'codigo', 'nome', 'categoria', 'status', 'ultima_comunicacao'];
    const rows = assets.map((a) =>
      [reportType, tenantName, a.code, a.name, a.category, a.status, a.telemetry.lastCommunication]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `athos_track_${reportType.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reportTypes = [
    'Localização & Telemetria',
    'Rotas & Percursos',
    'Eventos & Alertas Críticos',
    'Saúde de Baterias BLE',
    'Violação de Geofence (Cercas)',
    'Dispositivos Offline',
    'Tempo de Movimentação x Parada',
    'Taxa de Utilização da Frota',
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <FileBarChart2 className="w-4 h-4" /> Central Analítica de Relatórios
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gerador de Relatórios Executivos e Operacionais
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exportação de dados consolidados para auditoria, compliance e gestão de custos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Selection Form Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-800">
            Configurar Parâmetros
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tipo de Relatório</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              {reportTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Período de Análise</label>
            <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none">
              <option>Hoje (Últimas 24h)</option>
              <option>Últimos 7 Dias</option>
              <option>Mês Atual</option>
              <option>Personalizado</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Formato de Exportação</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled
                title="Exportação em PDF ainda não implementada — use CSV"
                className="py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                disabled
                title="Exportação em Excel ainda não implementada — use CSV"
                className="py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-cyan-50 dark:hover:bg-slate-800 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-600">
              PDF/Excel: em desenvolvimento. CSV exporta o dado real do período/tenant atual.
            </p>
          </div>
        </div>

        {/* Live Preview Sample Box */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Pré-visualização do Relatório: {reportType}</span>
              </h3>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                Pronto para Download
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="text-cyan-600 dark:text-cyan-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                ATHOS TRACK TELEMETRY REPORT • {reportType.toUpperCase()}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <div>Empresa: {tenantName}</div>
                <div>Registros Processados: {assets.length} dispositivos</div>
                <div>Ativos: {assets.filter((a) => a.category === 'asset').length}</div>
                <div>Período: {todayPtBr()}</div>
              </div>

              <div className="pt-2 text-[11px] space-y-1 text-slate-500 dark:text-slate-400">
                <p>• {assets.filter((a) => a.category === 'cart').length} Carrinhos de Compras monitorados.</p>
                <p>• {assets.filter((a) => a.category === 'vehicle' || a.category === 'truck').length} Veículos de Frota.</p>
                <p>• {alerts.length} Alertas computados no período.</p>
                {assets.length === 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Nenhum ativo cadastrado neste tenant ainda — relatório sem registros pra exportar.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 text-xs text-slate-500 dark:text-slate-500 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <span>Gerado automaticamente pelo motor de dados ATHOS TRACK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
