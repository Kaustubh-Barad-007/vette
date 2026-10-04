import type { PackageMetadata, VettingResult, RiskLevel } from '../types.js';
import { evaluatePackageHeuristics } from './heuristics.js';

export function calculateSlopScore(metadata: PackageMetadata): VettingResult {
  const heuristics = evaluatePackageHeuristics(metadata);

  // Sum points, baseline is 0
  let rawScore = 0;
  for (const h of heuristics) {
    rawScore += h.points;
  }

  // Clamp between 0 and 100
  const slopScore = Math.min(100, Math.max(0, rawScore));

  let riskLevel: RiskLevel = 'SAFE';
  if (slopScore >= 70) {
    riskLevel = 'DANGEROUS';
  } else if (slopScore >= 30) {
    riskLevel = 'SUSPICIOUS';
  }

  return {
    packageName: metadata.name,
    registry: metadata.registry,
    slopScore,
    riskLevel,
    heuristics,
    metadata,
    cached: false,
    timestamp: Date.now(),
  };
}
