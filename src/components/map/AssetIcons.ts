import L from 'leaflet';
import { AssetCategory, AssetStatus, AssetSubcategory } from '../../types';
import { ASSET_CATEGORY_META, getAssetSVGPath } from '../common/AssetIconRegistry';

export interface MarkerStyleOptions {
  isSelected?: boolean;
  status?: AssetStatus;
  heading?: number; // 0 - 360 degrees
  batteryLevel?: number;
  category: AssetCategory;
  subcategory?: string | AssetSubcategory;
  code?: string;
  name?: string;
  speed?: number;
  themeMode?: 'light' | 'dark';
}

export function getCategoryThemeColor(category: AssetCategory): {
  primary: string;
  secondary: string;
  bgClass: string;
  borderClass: string;
} {
  const meta = ASSET_CATEGORY_META[category] || ASSET_CATEGORY_META.asset;
  return {
    primary: meta.primaryColor,
    secondary: meta.secondaryColor,
    bgClass: meta.bgClass,
    borderClass: meta.borderClass,
  };
}

export function getStatusBadgeInfo(status?: AssetStatus): {
  label: string;
  color: string;
  badgeBg: string;
  dotColor: string;
} {
  switch (status) {
    case 'moving':
      return { label: 'MOVIMENTO', color: '#10b981', badgeBg: '#10b98120', dotColor: '#10b981' };
    case 'out_of_geofence':
      return { label: 'FORA DA CERCA', color: '#f43f5e', badgeBg: '#f43f5e25', dotColor: '#f43f5e' };
    case 'low_battery':
      return { label: 'BATERIA BAIXA', color: '#f59e0b', badgeBg: '#f59e0b25', dotColor: '#f59e0b' };
    case 'maintenance':
      return { label: 'MANUTENÇÃO', color: '#e11d48', badgeBg: '#e11d4825', dotColor: '#e11d48' };
    case 'offline':
      return { label: 'OFFLINE', color: '#64748b', badgeBg: '#64748b25', dotColor: '#64748b' };
    case 'stopped':
    case 'online':
    case 'available':
    case 'in_use':
    default:
      return { label: 'PARADO / OK', color: '#3b82f6', badgeBg: '#3b82f625', dotColor: '#3b82f6' };
  }
}

export function createAssetLeafletMarkerIcon(options: MarkerStyleOptions): L.DivIcon {
  const { isSelected, status, heading, category, subcategory } = options;
  const theme = getCategoryThemeColor(category);
  const statusInfo = getStatusBadgeInfo(status);

  // Always use sleek dark background for map icon badges for high interactive contrast
  const bgColor = '#0f172a';
  const borderColor = isSelected ? '#38bdf8' : statusInfo.color;

  // Size definition: keeps clear visual scale (cart: 34px, car: 38px, truck: 40px)
  let baseSize = 36;
  if (category === 'cart') baseSize = 34;
  if (category === 'truck') baseSize = 40;
  if (category === 'vehicle') baseSize = 38;

  const size = isSelected ? baseSize + 8 : baseSize;
  const anchor = size / 2;

  const svgPath = getAssetSVGPath(category, subcategory);
  const headingTransform = typeof heading === 'number' && heading > 0 ? `transform: rotate(${heading}deg);` : '';

  // Moving pulse animation element
  const isMoving = status === 'moving';
  const isAlert = status === 'out_of_geofence';

  const pulseHtml = isMoving
    ? `<span style="
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid ${statusInfo.color};
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        opacity: 0.75;
      "></span>`
    : isAlert
    ? `<span style="
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid #f43f5e;
        animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        opacity: 0.85;
      "></span>`
    : '';

  // Direction arrow indicator if heading is available
  const arrowHtml =
    typeof heading === 'number' && heading > 0
      ? `<div style="
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%) rotate(${heading}deg);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 9px solid ${statusInfo.color};
        "></div>`
      : '';

  // Status badge dot on marker top right
  const statusDotHtml = `<span style="
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background-color: ${statusInfo.dotColor};
    border: 2px solid ${bgColor};
    border-radius: 50%;
    z-index: 10;
  "></span>`;

  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px;" class="athos-marker-wrapper">
      ${pulseHtml}
      ${arrowHtml}
      <div style="
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${bgColor};
        border: 2.5px solid ${borderColor};
        box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 10px ${isSelected ? '#38bdf880' : 'transparent'};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        color: ${theme.secondary};
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        position: relative;
      ">
        <svg viewBox="0 0 24 24" width="100%" height="100%" style="${headingTransform}">
          ${svgPath}
        </svg>
        ${statusDotHtml}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'athos-asset-marker-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

export function createClusterLeafletIcon(count: number, categoryThemeColor = '#06b6d4', categoryName = 'ATIVOS'): L.DivIcon {
  const size = count > 100 ? 52 : count > 20 ? 44 : 38;
  const anchor = size / 2;

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.95);
      border: 3px solid ${categoryThemeColor};
      box-shadow: 0 0 15px ${categoryThemeColor}90;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: monospace;
      font-weight: 800;
      font-size: ${size > 42 ? '13px' : '11px'};
      cursor: pointer;
      position: relative;
    ">
      <span>${count}</span>
      <span style="font-size: 8px; color: ${categoryThemeColor}; font-weight: 700; margin-top: -2px; text-transform: uppercase;">${categoryName}</span>
    </div>
  `;

  return L.divIcon({
    className: 'athos-cluster-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

