import { describe, it, expect } from 'vitest';
import {
  resolveIconKey,
  resolveAssetVisual,
  resolveStatusVisual,
  buildSvgDocument,
  svgDocumentToDataUrl,
  resolveAssetImageDataUrl,
  STALE_AFTER_MINUTES,
} from './assetVisualResolver';

describe('assetVisualResolver — iconKey (categoria/subcategoria -> chave de ícone)', () => {
  it('carrinho vira "cart"; caixa vira "box"; tag vira "tag"', () => {
    expect(resolveIconKey('cart')).toBe('cart');
    expect(resolveIconKey('box')).toBe('box');
    expect(resolveIconKey('tag')).toBe('tag');
  });

  it('subcategorias com SVG próprio entram na chave (agro-cattle, asset-tractor)', () => {
    expect(resolveIconKey('agro', 'cattle')).toBe('agro-cattle');
    expect(resolveIconKey('agro', 'bovino')).toBe('agro-cattle');
    expect(resolveIconKey('asset', 'tractor')).toBe('asset-tractor');
    expect(resolveIconKey('asset', 'trator')).toBe('asset-tractor');
    expect(resolveIconKey('asset', 'moto')).toBe('asset-motorcycle');
  });

  it('subcategoria sem SVG próprio não muda a chave (cart/supermarket_cart -> cart)', () => {
    expect(resolveIconKey('cart', 'supermarket_cart')).toBe('cart');
    expect(resolveIconKey('box', 'sealed_box')).toBe('box');
  });

  it('default genérico apenas quando não há classificação', () => {
    expect(resolveIconKey('asset')).toBe('asset');
  });
});

describe('assetVisualResolver — resolveAssetVisual (ícone SVG centralizado)', () => {
  it('carrinho reusa o SVg do AssetIconRegistry (markup não vazio de carrinho)', () => {
    const v = resolveAssetVisual({ category: 'cart' });
    expect(v.iconKey).toBe('cart');
    expect(v.label).toContain('Carrinho');
    expect(v.svgMarkup).toContain('<');
    expect(v.svgMarkup).toContain('circle');
  });

  it('caixa tem índice próprio e markup de caixa', () => {
    const v = resolveAssetVisual({ category: 'box' });
    expect(v.iconKey).toBe('box');
    expect(v.svgMarkup.length).toBeGreaterThan(0);
  });

  it('tag tem ícone próprio (não genérico)', () => {
    const v = resolveAssetVisual({ category: 'tag' });
    expect(v.iconKey).toBe('tag');
  });

  it('agro com subcategoria cattle dá o markup bovino (vaca, não genérico)', () => {
    const v = resolveAssetVisual({ category: 'agro', subcategory: 'cattle' });
    expect(v.iconKey).toBe('agro-cattle');
    expect(v.svgMarkup).toContain('<');
  });

  it('cores vêm do ASSET_CATEGORY_META (carrinho ciano, caixa laranja)', () => {
    expect(resolveAssetVisual({ category: 'cart' }).primaryColor).toBe('#06b6d4');
    expect(resolveAssetVisual({ category: 'box' }).primaryColor).toBe('#f97316');
  });
});

describe('assetVisualResolver — estados visuais', () => {
  it('moving -> ONLINE/MOVIMENTO verde', () => {
    expect(resolveStatusVisual('moving').state).toBe('ONLINE');
    expect(resolveStatusVisual('moving').color).toBe('#10b981');
  });

  it('out_of_geofence e low_battery -> ALERT', () => {
    expect(resolveStatusVisual('out_of_geofence').state).toBe('ALERT');
    expect(resolveStatusVisual('low_battery').state).toBe('ALERT');
  });

  it('offline -> OFFLINE cinza', () => {
    const v = resolveStatusVisual('offline');
    expect(v.state).toBe('OFFLINE');
    expect(v.color).toBe('#64748b');
  });

  it('online com lastCommunication velho (ISO real) -> STALE, não ONLINE', () => {
    const now = Date.now();
    const old = new Date(now - (STALE_AFTER_MINUTES + 1) * 60_000).toISOString();
    expect(resolveStatusVisual('online', old, { now }).state).toBe('STALE');
  });

  it('"Agora" (placeholder de simulação) não vira STALE', () => {
    const now = Date.now();
    expect(resolveStatusVisual('online', 'Agora', { now }).state).toBe('ONLINE');
  });
});

describe('assetVisualResolver — construção do SVG/data URL (sem DOM)', () => {
  it('buildSvgDocument envolve o markup com <svg> e cor injetada', () => {
    const doc = buildSvgDocument('<path d="M0 0"/>', '#06b6d4');
    expect(doc.startsWith('<svg')).toBe(true);
    expect(doc).toContain('stroke="#06b6d4"');
    expect(doc).toContain('<path d="M0 0"/>');
    expect(doc).toContain('</svg>');
  });

  it('svgDocumentToDataUrl gera data URL UTF-8', () => {
    const url = svgDocumentToDataUrl('<svg>oi</svg>');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).not.toContain('{');
  });

  it('resolveAssetImageDataUrl de carrinho tem cart SVG+cor ciano', () => {
    const url = resolveAssetImageDataUrl({ category: 'cart' });
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(unescape(url)).toContain('#06b6d4');
  });
});