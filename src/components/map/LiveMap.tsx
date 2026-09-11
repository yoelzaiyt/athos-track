import React, { Suspense, lazy } from 'react';
import { AssetMap, AssetMapProps } from './AssetMap';

// MAP_V2_ENABLED (POC) — ver OPERATIONAL-MAP-ARCHITECTURE.md. Opt-in explícito:
// ausente/"false" = V1 (Leaflet, produção). "true" = V2 (MapLibre, POC isolada).
// Import dinâmico: o bundle do maplibre-gl só é baixado quando a flag está
// ativa — usuários em V1 (produção, flag off) não pagam esse custo de bundle.
const isMapV2Enabled = (import.meta.env.VITE_MAP_V2_ENABLED ?? 'false') === 'true';
const AssetMapV2 = lazy(() => import('./AssetMapV2').then((m) => ({ default: m.AssetMapV2 })));

export const LiveMap: React.FC<AssetMapProps> = (props) => {
  if (isMapV2Enabled) {
    // A POC V2 ainda não cobre todas as props de edição do V1 (geofence
    // editável, floor plan, replay, rotas) — fora de escopo desta fase.
    return (
      <Suspense fallback={<div className={props.heightClass ?? 'h-[calc(100vh-4rem)]'} />}>
        <AssetMapV2
          assetsList={props.assetsList}
          geofencesList={props.geofencesList}
          selectedAssetOverride={props.selectedAssetOverride}
          onSelectAsset={props.onSelectAsset}
          heightClass={props.heightClass}
          enableFollowMode={props.enableFollowMode}
        />
      </Suspense>
    );
  }
  return <AssetMap {...props} />;
};
