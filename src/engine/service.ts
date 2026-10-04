import type { RegistryType, VettingResult } from '../types.js';
import { fetchNpmMetadata } from '../registries/npm.js';
import { fetchPypiMetadata } from '../registries/pypi.js';
import { calculateSlopScore } from './scorer.js';
import { vetteCache } from '../cache/cache.js';

export async function vetPackage(
  packageName: string,
  registry: RegistryType = 'npm',
  options: { bypassCache?: boolean } = {}
): Promise<VettingResult> {
  // 1. Check local cache if not bypassed
  if (!options.bypassCache) {
    const cached = vetteCache.get(registry, packageName);
    if (cached) {
      return cached;
    }
  }

  // 2. Fetch metadata from registry
  const metadata = registry === 'pypi'
    ? await fetchPypiMetadata(packageName)
    : await fetchNpmMetadata(packageName);

  // 3. Compute SlopScore and evaluate heuristics
  const result = calculateSlopScore(metadata);

  // 4. Save to cache
  vetteCache.set(result);

  return result;
}
