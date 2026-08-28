// Registro central de providers de rastreamento (prompt multi-provider,
// seção 4). Um TrackingProvider real pode ser registrado sob mais de um
// alias — usado aqui porque "heile"/"jason"/"brgps" são o mesmo fornecedor
// (ver comentário em TrackingProvider.ts). Isso permite que telas/tabelas
// que já referenciam "heile" ou "jason" (nomes usados no brief recebido)
// resolvam pro mesmo provider real sem precisar migrar dado nenhum.

import type { TrackingProvider } from './TrackingProvider.ts';

export class ProviderRegistryImpl {
  private byId = new Map<string, TrackingProvider>();
  private aliases = new Map<string, string>();

  register(provider: TrackingProvider, aliases: string[] = []) {
    this.byId.set(provider.id, provider);
    for (const alias of aliases) this.aliases.set(alias, provider.id);
  }

  get(idOrAlias: string): TrackingProvider | undefined {
    const realId = this.aliases.get(idOrAlias) ?? idOrAlias;
    return this.byId.get(realId);
  }

  list(): TrackingProvider[] {
    return [...this.byId.values()];
  }
}

export const ProviderRegistry = new ProviderRegistryImpl();
