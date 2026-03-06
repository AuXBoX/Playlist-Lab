import { SourceAdapter, TargetAdapter } from './types';

export class AdapterRegistry {
  private sources = new Map<string, SourceAdapter>();
  private targets = new Map<string, TargetAdapter>();

  registerSource(adapter: SourceAdapter): void {
    this.sources.set(adapter.meta.id, adapter);
  }

  registerTarget(adapter: TargetAdapter): void {
    this.targets.set(adapter.meta.id, adapter);
  }

  getSource(id: string): SourceAdapter | undefined {
    return this.sources.get(id);
  }

  getTarget(id: string): TargetAdapter | undefined {
    return this.targets.get(id);
  }

  listSources(): SourceAdapter[] {
    return Array.from(this.sources.values());
  }

  listTargets(): TargetAdapter[] {
    return Array.from(this.targets.values()).filter(a => !a.meta.isSourceOnly);
  }
}

export const adapterRegistry = new AdapterRegistry();
