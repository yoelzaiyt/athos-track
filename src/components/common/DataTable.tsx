import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, Filter } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filtered = data.filter((item) => {
    if (!query.trim()) return true;
    return Object.values(item).some((val) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(query.toLowerCase());
    });
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    if (!data.length) return;
    const headers = columns.map((c) => c.header).join(',');
    const rows = filtered.map((row) =>
      columns
        ? columns
            .map((c) => {
              const val = typeof c.accessor === 'function' ? '' : row[c.accessor];
              return `"${String(val ?? '').replace(/"/g, '""')}"`;
            })
            .join(',')
        : ''
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title || 'export'}_athos_track.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {exportable && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700/50"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-8 text-center text-slate-400 dark:text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              paginated.map((item) => (
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

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </span>{' '}
          até{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {Math.min(currentPage * pageSize, filtered.length)}
          </span>{' '}
          de <span className="font-semibold text-slate-800 dark:text-slate-200">{filtered.length}</span> registros
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
