import React, { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { buildCsvContent, buildCsvFilename, downloadCsv } from '../../lib/csvExport';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  /** Valor bruto desta coluna no CSV. Use quando o que aparece na tela não
   *  serve como dado (ícone, badge sem texto, componente próprio) ou quando o
   *  CSV deve levar um formato diferente do visual — data ISO em vez de
   *  "há 5 min", número puro em vez de "85%". Tem precedência sobre o
   *  `accessor`. Sem ele, o CSV usa o texto do que a coluna renderiza. */
  exportAccessor?: (row: T) => string | number | boolean | null | undefined;
  /** `false` deixa a coluna de fora do CSV — pra coluna puramente visual
   *  (miniatura, semáforo, barra de progresso) sem valor textual. */
  exportable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  title?: string;
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  exportable?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  title,
  searchPlaceholder = 'Filtrar registros...',
  onRowClick,
  actions,
  exportable = true,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = data.filter((item) => {
    if (!query.trim()) return true;
    return Object.values(item).some((val) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(query.toLowerCase());
    });
  });

  // O CSV exporta o que está NA TELA: as linhas já filtradas pela busca, na
  // mesma ordem e com as mesmas colunas. Por isso o guard olha `filtered`, e
  // não `data` — antes, filtrar até zerar o resultado e clicar em CSV gerava
  // um arquivo só com cabeçalho. A montagem em si vive em src/lib/csvExport.ts
  // (escape, BOM, injeção de fórmula, valor por coluna), coberta por testes.
  const handleExportCSV = () => {
    if (!filtered.length) return;
    downloadCsv(buildCsvFilename(title), buildCsvContent(columns, filtered));
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {title && (
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {title}
            <span className="text-xs font-mono font-normal px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
              {filtered.length}
            </span>
          </h3>
        )}

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {exportable && (
            <button
              onClick={handleExportCSV}
              disabled={!filtered.length}
              title={filtered.length ? `Exportar ${filtered.length} registro(s) em CSV` : 'Nada para exportar com o filtro atual'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700/50"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive & Scrollable Table — cabeçalho fixo, corpo rola pra mostrar todos os registros filtrados de uma vez, sem paginação por clique */}
      <div className="athos-scroll overflow-x-auto overflow-y-auto max-h-[560px]">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4 py-3 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-8 text-center text-slate-400 dark:text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(item)
                        : (item[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                  {actions && (
                    <td
                      className="px-4 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: contagem total — a listagem inteira já é visível rolando a tabela acima */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-200">{filtered.length}</span>{' '}
        {filtered.length === 1 ? 'registro carregado' : 'registros carregados'}
      </div>
    </div>
  );
}
