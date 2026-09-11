import React from 'react';

interface MapV2ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface MapV2ErrorBoundaryState {
  hasError: boolean;
}

// AssetMapV2 (MapLibre) throws synchronously when WebGL2 is unavailable
// (old GPU drivers, disabled hardware acceleration, a crashed GPU process).
// Without this boundary that exception unmounts the whole React tree —
// found live while validating the MAP V2 POC, see MAP-V2-POC-REPORT.md.
export class MapV2ErrorBoundary extends React.Component<MapV2ErrorBoundaryProps, MapV2ErrorBoundaryState> {
  // react ships no type declarations in this project (no @types/react either),
  // so React.Component resolves to `any` and inherited members are invisible
  // to the checker unless redeclared here. `declare` keeps this type-only —
  // no runtime assignment, the real `this.props` still comes from React.
  declare props: Readonly<MapV2ErrorBoundaryProps>;
  state: MapV2ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapV2ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[MapV2ErrorBoundary] AssetMapV2 falhou, caindo para o V1:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
