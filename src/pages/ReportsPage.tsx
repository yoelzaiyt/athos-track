import React, { useState } from 'react';
import { FileBarChart2, Download, FileText, FileSpreadsheet, Calendar, Filter, Sparkles } from 'lucide-react';
import { useAssets } from '../context/AssetContext';

export const ReportsPage: React.FC = () => {
  const { assets, alerts } = useAssets();
  const [reportType, setReportType] = useState('Localização & Telemetria');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

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

  const handleExport = (exportFormat: 'pdf' | 'excel' | 'csv') => {
    alert(`Gerando relatório de "${reportType}" no formato ${exportFormat.toUpperCase()}. O download iniciará em instantes.`);
  };

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
                onClick={() => handleExport('pdf')}
                className="py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-slate-800 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-cyan-50 dark:hover:bg-slate-800 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
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
                <div>Empresa: Assaí Atacadista (Piloto de Testes)</div>
                <div>Registros Processados: {assets.length} dispositivos</div>
                <div>Integridade dos Dados: 99.8%</div>
                <div>Período: 10/08/2026 - Hoje</div>
              </div>

              <div className="pt-2 text-[11px] space-y-1 text-slate-500 dark:text-slate-400">
                <p>• 250 Carrinhos de Compras monitorados via BLE Gateway.</p>
                <p>• 35 Veículos de Frota com protocolo GT06 operacionais.</p>
                <p>• {alerts.length} Alertas de cercas virtuais computados no período.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 text-xs text-slate-500 dark:text-slate-500 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <span>Gerado automaticamente pelo motor de dados ATHOS TRACK</span>
            <span>Segurança ISO 27001 Audited</span>
          </div>
        </div>
      </div>
    </div>
  );
};
