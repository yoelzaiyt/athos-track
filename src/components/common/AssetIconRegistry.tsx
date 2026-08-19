import React from 'react';
import {
  ShoppingCart,
  Car,
  Truck,
  Bike,
  Package,
  Laptop,
  Zap,
  Wrench,
  Cog,
  Factory,
  Tag,
  Radio,
  Snowflake,
  Cpu,
  Box,
} from 'lucide-react';
import { AssetCategory, AssetSubcategory } from '../../types';

export interface AssetCategoryMeta {
  category: AssetCategory;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  defaultSubcategory: string;
}

// Map of categories and metadata
export const ASSET_CATEGORY_META: Record<AssetCategory, AssetCategoryMeta> = {
  cart: {
    category: 'cart',
    label: 'Carrinho de Supermercado',
    primaryColor: '#06b6d4', // Cyan
    secondaryColor: '#22d3ee',
    bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    borderClass: 'border-cyan-500/30',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    defaultSubcategory: 'supermarket_cart',
  },
  vehicle: {
    category: 'vehicle',
    label: 'Automóvel / Veículo Leve',
    primaryColor: '#3b82f6', // Blue
    secondaryColor: '#60a5fa',
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-600 dark:text-blue-400',
    defaultSubcategory: 'car',
  },
  truck: {
    category: 'truck',
    label: 'Caminhão / Frota Pesada',
    primaryColor: '#f59e0b', // Amber
    secondaryColor: '#fbbf24',
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-600 dark:text-amber-400',
    defaultSubcategory: 'truck',
  },
  forklift: {
    category: 'forklift',
    label: 'Empilhadeira / CD Logística',
    primaryColor: '#eab308', // Yellow
    secondaryColor: '#fde047',
    bgClass: 'bg-yellow-500/10 dark:bg-yellow-500/20',
    borderClass: 'border-yellow-500/30',
    textClass: 'text-yellow-600 dark:text-yellow-400',
    defaultSubcategory: 'forklift',
  },
  bike: {
    category: 'bike',
    label: 'Bicicleta / Mobilidade',
    primaryColor: '#10b981', // Emerald
    secondaryColor: '#34d399',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    defaultSubcategory: 'bike',
  },
  cargo: {
    category: 'cargo',
    label: 'Carga / Caixa Rastreável',
    primaryColor: '#a855f7', // Purple
    secondaryColor: '#c084fc',
    bgClass: 'bg-purple-500/10 dark:bg-purple-500/20',
    borderClass: 'border-purple-500/30',
    textClass: 'text-purple-600 dark:text-purple-400',
    defaultSubcategory: 'cargo_box',
  },
  asset: {
    category: 'asset',
    label: 'Ativo / Equipamento Especializado',
    primaryColor: '#6366f1', // Indigo
    secondaryColor: '#818cf8',
    bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    borderClass: 'border-indigo-500/30',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    defaultSubcategory: 'generator',
  },
  tag: {
    category: 'tag',
    label: 'Tag BLE / Dispositivo Micro',
    primaryColor: '#0284c7', // Sky
    secondaryColor: '#38bdf8',
    bgClass: 'bg-sky-500/10 dark:bg-sky-500/20',
    borderClass: 'border-sky-500/30',
    textClass: 'text-sky-600 dark:text-sky-400',
    defaultSubcategory: 'tag',
  },
  agro: {
    category: 'agro',
    label: 'Agro / Gado & Máquinas',
    primaryColor: '#84cc16', // Lime
    secondaryColor: '#a3e635',
    bgClass: 'bg-lime-500/10 dark:bg-lime-500/20',
    borderClass: 'border-lime-500/30',
    textClass: 'text-lime-600 dark:text-lime-400',
    defaultSubcategory: 'cattle',
  },
};

// SVG Paths for Leaflet map markers
export function getAssetSVGPath(category: AssetCategory, subcategory?: string | AssetSubcategory): string {
  const sub = subcategory ? String(subcategory).toLowerCase() : '';

  // Specific Subcategories
  if (sub === 'cattle' || sub === 'bovino' || sub === 'gado' || sub === 'cow') {
    // Cow / Bovine SVG
    return `<path d="M19 8c0-1.1-.9-2-2-2h-2l-1-2h-4L9 6H7c-1.1 0-2 .9-2 2v4l-2 1v3l2 1v3h2v-2h6v2h2v-3l2-1v-3l-2-1V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 6L2 4M19 6l3-2M9 10h.01M15 10h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  if (sub === 'horse' || sub === 'equino' || sub === 'cavalo') {
    // Horse / Equine SVG
    return `<path d="M20 5l-4 1-3 4-3-1L7 6 3 8l3 4c0 3 2 5 5 6h1v3h3v-3h2v3h2v-5c2-2 3-5 2-7l2-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 9c-1 0-2 1-2 2" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }

  if (sub === 'sheep' || sub === 'ovino' || sub === 'ovelha') {
    // Sheep / Ovino SVG
    return `<path d="M8 8a3.5 3.5 0 0 1 7 0 3 3 0 0 1 3 3 3 3 0 0 1-1 5.8V19h-2v-2h-6v2H7v-2.2A3 3 0 0 1 5 11a3 3 0 0 1 8-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 10l3 1-1 2-2-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  if (sub === 'goat' || sub === 'caprino' || sub === 'cabra' || sub === 'bode') {
    // Goat / Caprino SVG
    return `<path d="M9 9a3 3 0 0 1 6 0v1a3 3 0 0 1 3 3 3 3 0 0 1-1 5.8V19h-2v-2h-6v2H7v-2.2A3 3 0 0 1 6 11a3 3 0 0 1 3-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9L6 5M15 9l3-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  if (sub === 'buffalo' || sub === 'bufalo' || sub === 'búfalo') {
    // Buffalo / Búfalo SVG (cabeça mais larga, chifres curvos característicos)
    return `<path d="M19 9c0-1.1-.9-2-2-2h-1l-1-2H9L8 7H7c-1.1 0-2 .9-2 2v4l-2 1v3l2 1v3h2v-2h6v2h2v-3l2-1v-3l-2-1V9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7C4 6 3 4 4 2M17 7c3-1 4-3 3-5M9 11h.01M15 11h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  if (sub === 'tractor' || sub === 'trator' || sub === 'harvester' || sub === 'maquina_agricola') {
    // Tractor SVG
    return `<circle cx="7" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 14h6l2-6h5v7M10 8V5h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17h2" stroke="currentColor" stroke-width="2"/>`;
  }

  if (sub === 'motorcycle' || sub === 'moto') {
    // Motorcycle SVG
    return `<circle cx="5" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 16l4-7h4l3 7M13 9l4 2M9 9H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  if (sub === 'notebook' || sub === 'laptop') {
    // Laptop SVG
    return `<rect x="4" y="4" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 19h20M9 15v2M15 15v2" stroke="currentColor" stroke-width="2"/>`;
  }

  if (sub === 'generator' || sub === 'gerador') {
    // Zap / Generator SVG
    return `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  if (sub === 'freezer' || sub === 'refrigerado') {
    // Snowflake / Freezer SVG
    return `<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  if (sub === 'tool' || sub === 'ferramenta') {
    // Wrench SVG
    return `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.9 6.91a2.12 2.12 0 0 1-3-3l6.91-6.9a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }

  if (sub === 'machine' || sub === 'maquina') {
    // Factory SVG
    return `<path d="M2 20h20M3 20V10l4 3V10l4 3V7l5 3v10M17 3v4M21 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Category Level Fallbacks
  switch (category) {
    case 'cart':
      // Shopping Cart SVG
      return `<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="21" r="1.5" fill="currentColor"/><circle cx="20" cy="21" r="1.5" fill="currentColor"/>`;
    case 'truck':
      // Truck SVG
      return `<rect x="1" y="3" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="16 8 20 8 23 11 23 16 16 16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5.5" cy="18.5" r="2.5" fill="currentColor"/><circle cx="18.5" cy="18.5" r="2.5" fill="currentColor"/>`;
    case 'vehicle':
      // Car SVG
      return `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.3.9L2 11c-.6.2-1 .8-1 1.4V16c0 .6.4 1 1 1h2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="17" r="2" fill="currentColor"/><circle cx="17" cy="17" r="2" fill="currentColor"/>`;
    case 'forklift':
      // Forklift SVG
      return `<path d="M2 19h14v-6h-4V5H8v8H2v6z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="13" cy="19" r="2" fill="currentColor"/><path d="M16 19h5M21 10v9M16 10h5" fill="none" stroke="currentColor" stroke-width="2"/>`;
    case 'bike':
      // Bike SVG
      return `<circle cx="5.5" cy="17.5" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18.5" cy="17.5" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5l-3.5-7h-3M12 10.5l3.5 7M12 10.5h6" fill="none" stroke="currentColor" stroke-width="2"/>`;
    case 'cargo':
      // Package SVG
      return `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>`;
    case 'agro':
      // Bovine Cow SVG Default for Agro
      return `<path d="M19 8c0-1.1-.9-2-2-2h-2l-1-2h-4L9 6H7c-1.1 0-2 .9-2 2v4l-2 1v3l2 1v3h2v-2h6v2h2v-3l2-1v-3l-2-1V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 6L2 4M19 6l3-2M9 10h.01M15 10h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
    case 'tag':
      // Tag Microchip SVG
      return `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" fill="none" stroke="currentColor" stroke-width="2"/>`;
    default:
      // Generic Box
      return `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M9 21V9" stroke="currentColor" stroke-width="2"/>`;
  }
}

export interface AssetIconProps {
  category: AssetCategory;
  subcategory?: string | AssetSubcategory;
  className?: string;
  size?: number;
}

// Custom Vector Components for Agro/Agri & Special Assets
export const CowIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 8c0-1.1-.9-2-2-2h-2l-1-2h-4L9 6H7c-1.1 0-2 .9-2 2v4l-2 1v3l2 1v3h2v-2h6v2h2v-3l2-1v-3l-2-1V8z" />
    <path d="M5 6L2 4M19 6l3-2M9 10h.01M15 10h.01" />
  </svg>
);

export const HorseIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 5l-4 1-3 4-3-1L7 6 3 8l3 4c0 3 2 5 5 6h1v3h3v-3h2v3h2v-5c2-2 3-5 2-7l2-4z" />
    <path d="M10 9c-1 0-2 1-2 2" />
  </svg>
);

export const SheepIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 8a3.5 3.5 0 0 1 7 0 3 3 0 0 1 3 3 3 3 0 0 1-1 5.8V19h-2v-2h-6v2H7v-2.2A3 3 0 0 1 5 11a3 3 0 0 1 8-3z" />
    <path d="M18 10l3 1-1 2-2-1" />
  </svg>
);

export const GoatIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9a3 3 0 0 1 6 0v1a3 3 0 0 1 3 3 3 3 0 0 1-1 5.8V19h-2v-2h-6v2H7v-2.2A3 3 0 0 1 6 11a3 3 0 0 1 3-2z" />
    <path d="M9 9L6 5M15 9l3-4" />
  </svg>
);

export const BuffaloIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 9c0-1.1-.9-2-2-2h-1l-1-2H9L8 7H7c-1.1 0-2 .9-2 2v4l-2 1v3l2 1v3h2v-2h6v2h2v-3l2-1v-3l-2-1V9z" />
    <path d="M7 7C4 6 3 4 4 2M17 7c3-1 4-3 3-5M9 11h.01M15 11h.01" />
  </svg>
);

export const TractorIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="17" r="3" />
    <circle cx="18" cy="15" r="5" />
    <path d="M7 14h6l2-6h5v7M10 8V5h3" />
    <path d="M2 17h2" />
  </svg>
);

export const ForkliftIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 19h14v-6h-4V5H8v8H2v6z" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="13" cy="19" r="2" />
    <path d="M16 19h5M21 10v9M16 10h5" />
  </svg>
);

export const MotorcycleIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="16" r="3" />
    <circle cx="19" cy="16" r="3" />
    <path d="M5 16l4-7h4l3 7M13 9l4 2M9 9H6" />
  </svg>
);

// Unified React Component for UI Icons across all views
export const AssetIcon: React.FC<AssetIconProps> = ({
  category,
  subcategory,
  className = 'w-4 h-4',
  size,
}) => {
  const sub = subcategory ? String(subcategory).toLowerCase() : '';

  if (sub === 'cattle' || sub === 'bovino' || sub === 'gado' || sub === 'cow') {
    return <CowIcon className={className} size={size} />;
  }
  if (sub === 'horse' || sub === 'equino' || sub === 'cavalo') {
    return <HorseIcon className={className} size={size} />;
  }
  if (sub === 'sheep' || sub === 'ovino' || sub === 'ovelha') {
    return <SheepIcon className={className} size={size} />;
  }
  if (sub === 'goat' || sub === 'caprino' || sub === 'cabra' || sub === 'bode') {
    return <GoatIcon className={className} size={size} />;
  }
  if (sub === 'buffalo' || sub === 'bufalo' || sub === 'búfalo') {
    return <BuffaloIcon className={className} size={size} />;
  }
  if (sub === 'tractor' || sub === 'trator' || sub === 'harvester' || sub === 'maquina_agricola') {
    return <TractorIcon className={className} size={size} />;
  }
  if (sub === 'motorcycle' || sub === 'moto') {
    return <MotorcycleIcon className={className} size={size} />;
  }
  if (sub === 'forklift' || category === 'forklift') {
    return <ForkliftIcon className={className} size={size} />;
  }
  if (sub === 'notebook' || sub === 'laptop') {
    return <Laptop className={className} size={size} />;
  }
  if (sub === 'generator' || sub === 'gerador') {
    return <Zap className={className} size={size} />;
  }
  if (sub === 'freezer' || sub === 'refrigerado') {
    return <Snowflake className={className} size={size} />;
  }
  if (sub === 'tool' || sub === 'ferramenta') {
    return <Wrench className={className} size={size} />;
  }
  if (sub === 'machine' || sub === 'maquina') {
    return <Factory className={className} size={size} />;
  }

  switch (category) {
    case 'cart':
      return <ShoppingCart className={className} size={size} />;
    case 'vehicle':
      return <Car className={className} size={size} />;
    case 'truck':
      return <Truck className={className} size={size} />;
    case 'bike':
      return <Bike className={className} size={size} />;
    case 'cargo':
      return <Package className={className} size={size} />;
    case 'tag':
      return <Tag className={className} size={size} />;
    case 'agro':
      return <CowIcon className={className} size={size} />;
    case 'asset':
      return <Box className={className} size={size} />;
    default:
      return <Box className={className} size={size} />;
  }
};
