/**
 * OOAD layering rules for generated projects (Phase 6, Task 26).
 *
 * The Architect's skeleton puts code in `src/{domain,application,infrastructure,presentation}`;
 * dependencies may only point inwards (towards the domain). A file outside these folders
 * (e.g. the composition root) is not checked.
 */
export type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation';

const LAYERS: readonly Layer[] = ['domain', 'application', 'infrastructure', 'presentation'];

const ALLOWED: Record<Layer, readonly Layer[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  presentation: ['domain', 'application', 'presentation'],
};

export function layerOf(path: string): Layer | null {
  const parts = path.replace(/\\/g, '/').split('/');
  for (const part of parts) {
    if ((LAYERS as readonly string[]).includes(part)) return part as Layer;
  }
  return null;
}

/** Resolves a relative import against the importing file; package imports return null */
export function resolveImport(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const parts = fromPath.replace(/\\/g, '/').split('/').slice(0, -1);
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/** The forbidden dependency, or null when the import is allowed */
export function layerViolation(fromPath: string, specifier: string): { from: Layer; to: Layer } | null {
  const from = layerOf(fromPath);
  const target = resolveImport(fromPath, specifier);
  if (!from || !target) return null;
  const to = layerOf(target);
  if (!to || ALLOWED[from].includes(to)) return null;
  return { from, to };
}
