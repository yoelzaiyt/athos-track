// Definição das colunas da tabela de Usuários (RBAC).
//
// Módulo próprio pra que o teste do CSV possa importar as colunas REAIS sem
// subir os contexts da aplicação, e pra que a regra de exportação fique ao
// lado da regra de exibição.

import React from 'react';
import { Column } from '../../components/common/DataTable';
import { UserProfile } from '../../types';
/** Descrição do que cada papel enxerga. Fica aqui, em função, porque a mesma
 *  frase é usada na tela E no CSV (`exportAccessor`) — duplicar o `switch`
 *  entre os dois seria garantir que um dia eles divergissem. */
export function rolePermissionsLabel(role: UserProfile['role']): string {
  switch (role) {
    case 'ATHOS_ADMIN':
      return 'Acesso Global Total';
    case 'FLEET_MANAGER':
      return 'Frotas + Cargas + Mapas';
    case 'CART_MANAGER':
      return 'Carrinhos + Tags + Mapas';
    case 'ASSET_MANAGER':
      return 'Ativos + Tags + Mapas';
    case 'CLIENT_ADMIN':
      return 'Administração do Cliente';
    case 'OPERATOR':
      return 'Operação do Dia a Dia';
    default:
      return 'Somente Visualização';
  }
}

export function userScopeLabel(row: UserProfile): string {
  if (!row.clientId) return 'Todos os clientes';
  return row.unitId ? 'Cliente + Unidade' : 'Cliente';
}

// Colunas em escopo de módulo (não dependem de estado do componente) pra
// poderem ser exercitadas pelo teste do CSV com as definições REAIS —
// ver src/lib/csvExport.test.ts.
export const userColumns: Column<UserProfile>[] = [
    {
      header: 'Usuário',
      // A célula mostra nome e e-mail em duas linhas; no CSV isso vira um
      // campo só, explícito, em vez de depender da extração do JSX.
      exportAccessor: (row) => `${row.name} (${row.email})`,
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-full flex items-center justify-center font-bold text-xs">
              {row.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100">{row.name}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Papel RBAC',
      // Na tela o papel aparece "bonito" (CLIENT ADMIN); no CSV vai o valor
      // real do banco (CLIENT_ADMIN), que é o que serve pra filtrar/cruzar.
      exportAccessor: (row) => row.role,
      accessor: (row) => (
        <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg uppercase">
          {row.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Permissões do Papel',
      exportAccessor: (row) => rolePermissionsLabel(row.role),
      accessor: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">{rolePermissionsLabel(row.role)}</span>
      ),
    },
    {
      header: 'Escopo',
      exportAccessor: (row) => userScopeLabel(row),
      accessor: (row) => (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{userScopeLabel(row)}</span>
      ),
    },
];
