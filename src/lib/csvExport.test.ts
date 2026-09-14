// Testes do export CSV do DataTable.
//
// Duas metades, de propósito:
//   1. As regras genéricas (escape, BOM, CRLF, injeção de fórmula, extração
//      de texto do JSX) — unitárias.
//   2. As TRÊS TABELAS REAIS do app (Carrinhos, Ativos, Usuários), usando as
//      definições de coluna de verdade importadas das páginas — não cópias.
//      É o que prova que o bug original (toda coluna com accessor em função
//      exportando string vazia) está fechado onde o usuário de fato clica.

import { describe, expect, it } from 'vitest';
import React from 'react';
import {
  buildCsvContent,
  buildCsvFilename,
  escapeCsvField,
  neutralizeFormulaInjection,
  reactNodeToText,
  resolveExportValue,
  UTF8_BOM,
} from './csvExport';
import { cartColumns } from '../pages/columns/cartColumns';
import { assetColumns } from '../pages/columns/assetColumns';
import { userColumns } from '../pages/columns/userColumns';
import type { AssetDevice, UserProfile } from '../types';

/** Divide uma linha de CSV totalmente aspeada em campos já desescapados —
 *  é o parser mínimo que o teste precisa pra conferir célula a célula. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function csvLines(content: string): string[] {
  return content.replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');
}

describe('escape e formato do arquivo', () => {
  it('aspeia todo campo e duplica aspas internas', () => {
    expect(escapeCsvField('simples')).toBe('"simples"');
    expect(escapeCsvField('tem, vírgula')).toBe('"tem, vírgula"');
    expect(escapeCsvField('diz "olá"')).toBe('"diz ""olá"""');
    expect(escapeCsvField('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(escapeCsvField('')).toBe('""');
  });

  it('começa com BOM UTF-8 e separa linhas com CRLF', () => {
    const csv = buildCsvContent([{ header: 'Ação', accessor: 'valor' }], [{ valor: 'ok' }]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv).not.toMatch(/[^\r]\n/); // nenhum LF solto
  });

  it('preserva acentuação exatamente como está no dado', () => {
    const csv = buildCsvContent(
      [{ header: 'Patrimônio', accessor: 'v' }],
      [{ v: 'Manutenção corretiva — pátio São João (ação nº 3)' }]
    );
    expect(csv).toContain('Patrimônio');
    expect(csv).toContain('Manutenção corretiva — pátio São João (ação nº 3)');
    // Em bytes UTF-8, o BOM é EF BB BF — é isso que faz o Excel pt-BR abrir
    // certo em vez de mostrar "PatrimÃ´nio".
    const bytes = Buffer.from(csv, 'utf8');
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('neutraliza injeção de fórmula sem estragar número negativo', () => {
    expect(neutralizeFormulaInjection('=1+1')).toBe("'=1+1");
    expect(neutralizeFormulaInjection('+55 11 99999')).toBe("'+55 11 99999");
    expect(neutralizeFormulaInjection('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeFormulaInjection('-2+3+cmd|calc')).toBe("'-2+3+cmd|calc");
    // Coordenada real não pode ser poluída — é o dado mais comum do sistema.
    expect(neutralizeFormulaInjection('-23.55052, -46.63331')).toBe('-23.55052, -46.63331');
    expect(neutralizeFormulaInjection('-15')).toBe('-15');
    expect(neutralizeFormulaInjection("-2+3+cmd|'/C calc'!A0")).toBe("'-2+3+cmd|'/C calc'!A0");
    // Texto que começa com travessão/hífen também é neutralizado — só número puro escapa da regra.
    expect(neutralizeFormulaInjection('-sem número')).toBe("'-sem número");
  });

  it('monta nome de arquivo seguro a partir do título da tabela', () => {
    const nome = buildCsvFilename('Inventário de Carrinhos / Zaffari', new Date(2026, 8, 12));
    expect(nome).toBe('athos_track_inventario_de_carrinhos_zaffari_20260912.csv');
    expect(buildCsvFilename(undefined, new Date(2026, 8, 12))).toBe('athos_track_export_20260912.csv');
  });

  it('respeita exportable: false', () => {
    const csv = buildCsvContent(
      [
        { header: 'Nome', accessor: 'nome' },
        { header: 'Miniatura', accessor: () => null, exportable: false },
      ],
      [{ nome: 'CAR-01' }]
    );
    const [header, linha] = csvLines(csv);
    expect(parseCsvLine(header)).toEqual(['Nome']);
    expect(parseCsvLine(linha)).toEqual(['CAR-01']);
  });
});

describe('valor da célula (a regressão original)', () => {
  it('extrai o texto de um accessor em função — antes isso saía vazio', () => {
    const coluna = {
      header: 'Status',
      accessor: (row: { status: string }) => React.createElement('span', { className: 'badge' }, 'Fora da Loja'),
    };
    expect(resolveExportValue(coluna, { status: 'out_of_geofence' })).toBe('Fora da Loja');
  });

  it('separa elementos irmãos com espaço, mas não quebra texto colado', () => {
    const duasLinhas = React.createElement(
      'div',
      null,
      React.createElement('div', null, 'CAR-01'),
      React.createElement('div', null, 'Carrinho Frente de Loja')
    );
    expect(reactNodeToText(duasLinhas)).toBe('CAR-01 Carrinho Frente de Loja');

    const porcentagem = React.createElement('span', null, 85, '%');
    expect(reactNodeToText(porcentagem)).toBe('85%');
  });

  it('ignora ícone/componente sem texto e nós vazios', () => {
    const Icone: React.FC = () => null;
    const node = React.createElement('span', null, React.createElement(Icone, null), ' API BRGPS');
    expect(reactNodeToText(node)).toBe('API BRGPS');
    expect(reactNodeToText(null)).toBe('');
    expect(reactNodeToText(undefined)).toBe('');
    expect(reactNodeToText(false)).toBe('');
  });

  it('exportAccessor tem precedência sobre o que aparece na tela', () => {
    const coluna = {
      header: 'Última Comunicação',
      exportAccessor: (row: { iso: string }) => row.iso,
      accessor: (row: { iso: string }) => React.createElement('span', null, 'há 5 minutos'),
    };
    expect(resolveExportValue(coluna, { iso: '2026-09-12T10:00:00Z' })).toBe('2026-09-12T10:00:00Z');
  });

  it('null e undefined viram célula vazia, não a string "null"', () => {
    expect(resolveExportValue({ header: 'X', accessor: 'v' }, { v: null })).toBe('');
    expect(resolveExportValue({ header: 'X', accessor: 'v' }, { v: undefined })).toBe('');
    expect(resolveExportValue({ header: 'X', accessor: () => null, exportAccessor: () => null }, {})).toBe('');
  });
});

// ===================== As 3 tabelas reais =====================

function makeAsset(over: Partial<AssetDevice> = {}): AssetDevice {
  return {
    id: 'a1',
    name: 'Carrinho Frente de Loja',
    code: 'CAR-01',
    imei: '3092660181',
    category: 'cart',
    clientId: 'c1',
    unitId: 'u1',
    unitName: 'São João — Matriz',
    status: 'out_of_geofence',
    protocol: 'GT06',
    lastMovement: '2026-09-12 08:30',
    telemetry: {
      latitude: -23.55052,
      longitude: -46.63331,
      speed: 0,
      batteryLevel: 87,
      signalStrength: 72,
      lastCommunication: '2026-09-12T11:42:07.000Z',
    },
    ...over,
  } as AssetDevice;
}

describe('tabela real: Carrinhos (cartColumns)', () => {
  const rows = [
    makeAsset({ provider: 'BRGPS_2', telemetry: { ...makeAsset().telemetry, batteryLevelCategory: 'LOW' } } as Partial<AssetDevice>),
    makeAsset({
      id: 'a2',
      code: 'CAR-02',
      name: 'Carrinho "Reforçado", ala B',
      status: 'online',
      geofenceName: 'Pátio Coberto',
      provider: undefined,
      telemetry: { ...makeAsset().telemetry, latitude: 0, longitude: 0, batteryLevel: 12 },
    } as Partial<AssetDevice>),
  ];

  it('exporta todas as colunas com conteúdo real — nenhuma célula vazia por acidente', () => {
    const csv = buildCsvContent(cartColumns as never, rows as never);
    const [header, ...body] = csvLines(csv);
    const headers = parseCsvLine(header);

    expect(headers).toEqual([
      'ID / Patrimônio',
      'Unidade',
      'Tag BLE / IMEI',
      'Status Perímetro',
      'Bateria',
      'Última Localização',
      'Origem',
      'Última Comunicação',
    ]);
    expect(body).toHaveLength(2);

    const linha1 = parseCsvLine(body[0]);
    expect(linha1[0]).toBe('CAR-01 — Carrinho Frente de Loja');
    expect(linha1[1]).toBe('São João — Matriz');
    expect(linha1[2]).toBe('3092660181');
    expect(linha1[3]).toBe('Fora da Loja');
    expect(linha1[4]).toBe('Baixa'); // provider real: faixa, nunca "%" inventado
    expect(linha1[5]).toBe('-23.55052, -46.63331');
    expect(linha1[6]).toBe('API BRGPS_2');
    expect(linha1[7]).toBe('2026-09-12T11:42:07.000Z');

    // Nenhuma célula da primeira linha ficou vazia (era o sintoma do bug).
    expect(linha1.filter((c) => c === '')).toHaveLength(0);
  });

  it('escapa aspas e vírgula vindas do nome do ativo, e a coordenada sobrevive inteira', () => {
    const csv = buildCsvContent(cartColumns as never, rows as never);
    expect(csv).toContain('"CAR-02 — Carrinho ""Reforçado"", ala B"');

    const linha2 = parseCsvLine(csvLines(csv)[2]);
    expect(linha2[0]).toBe('CAR-02 — Carrinho "Reforçado", ala B');
    expect(linha2[4]).toBe('12%'); // sem provider: percentual real do dispositivo
    expect(linha2[5]).toBe('Pátio Coberto'); // sem posição e sem provider: cerca, sem inventar coordenada
    expect(linha2[6]).toBe('Simulado');
  });
});

describe('tabela real: Ativos (assetColumns)', () => {
  const rows = [
    makeAsset({
      id: 'b1',
      name: 'Gerador Portátil',
      code: 'ATV-77',
      category: 'asset',
      protocol: 'Suntech',
      responsibleName: 'Maria Conceição',
      geofenceName: 'Galpão 3',
      status: 'in_use',
      lastMovement: '2026-09-11 17:04',
    } as Partial<AssetDevice>),
    makeAsset({ id: 'b2', name: 'Tag avulsa', code: 'TAG-09', category: 'tag', responsibleName: undefined } as Partial<AssetDevice>),
  ];

  it('exporta valores brutos úteis pra planilha (bateria numérica, sem travessão)', () => {
    const csv = buildCsvContent(assetColumns as never, rows as never);
    const [header, ...body] = csvLines(csv);
    expect(parseCsvLine(header)).toContain('Localização / Unidade');

    const l1 = parseCsvLine(body[0]);
    expect(l1[0]).toBe('Gerador Portátil (ATV-77)');
    expect(l1[1]).toBe('Equipamento Especial');
    expect(l1[2]).toBe('Maria Conceição');
    expect(l1[3]).toBe('São João — Matriz / Galpão 3');
    expect(l1[4]).toBe('Suntech');
    expect(l1[5]).toBe('87'); // número puro, some/ordena na planilha
    expect(l1[6]).toBe('in_use');
    expect(l1[7]).toBe('2026-09-11 17:04');

    // Sem responsável, a célula fica VAZIA em vez de levar o travessão do visual.
    const l2 = parseCsvLine(body[1]);
    expect(l2[1]).toBe('Tag de Ativo');
    expect(l2[2]).toBe('');
  });
});

describe('tabela real: Usuários (userColumns)', () => {
  const rows: UserProfile[] = [
    { id: 'u1', name: 'João Conceição', email: 'joao@zaffari.com.br', role: 'CLIENT_ADMIN', clientId: 'c1' },
    { id: 'u2', name: 'Ana Paula', email: 'ana@athostrack.com.br', role: 'ATHOS_ADMIN' },
    { id: 'u3', name: 'Carlos Réu', email: 'carlos@zaffari.com.br', role: 'OPERATOR', clientId: 'c1', unitId: 'un1' },
  ];

  it('exporta identificação, papel cru e escopo legível', () => {
    const csv = buildCsvContent(userColumns as never, rows as never);
    const [header, ...body] = csvLines(csv);
    expect(parseCsvLine(header)).toEqual(['Usuário', 'Papel RBAC', 'Permissões do Papel', 'Escopo']);

    expect(parseCsvLine(body[0])).toEqual([
      'João Conceição (joao@zaffari.com.br)',
      'CLIENT_ADMIN',
      'Administração do Cliente',
      'Cliente',
    ]);
    expect(parseCsvLine(body[1])).toEqual([
      'Ana Paula (ana@athostrack.com.br)',
      'ATHOS_ADMIN',
      'Acesso Global Total',
      'Todos os clientes',
    ]);
    expect(parseCsvLine(body[2])[3]).toBe('Cliente + Unidade');
  });

  it('nenhuma linha das 3 tabelas reais sai só com cabeçalho preenchido', () => {
    for (const [nome, colunas, dados] of [
      ['carrinhos', cartColumns, [makeAsset()]],
      ['ativos', assetColumns, [makeAsset({ category: 'asset' } as Partial<AssetDevice>)]],
      ['usuários', userColumns, rows],
    ] as const) {
      const body = csvLines(buildCsvContent(colunas as never, dados as never)).slice(1);
      for (const linha of body) {
        const preenchidas = parseCsvLine(linha).filter((c) => c.trim() !== '');
        expect(preenchidas.length, `${nome}: linha sem nenhuma célula preenchida`).toBeGreaterThan(0);
      }
    }
  });
});
