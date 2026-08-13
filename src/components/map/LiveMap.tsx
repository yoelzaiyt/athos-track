import React from 'react';
import { AssetMap, AssetMapProps } from './AssetMap';

export const LiveMap: React.FC<AssetMapProps> = (props) => {
  return <AssetMap {...props} />;
};
