export type RegistryType = 'npm' | 'pypi';

export type RiskLevel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';

export interface PackageAuthor {
  name?: string;
  email?: string;
}

export interface PackageMetadata {
  name: string;
  registry: RegistryType;
  latestVersion?: string;
  createdAt?: string; // ISO string
  latestPublishedAt?: string; // ISO string
  author?: PackageAuthor;
  maintainers: string[];
  downloadsLastWeek: number;
  hasInstallScripts: boolean;
  installScripts: Record<string, string>;
  isNotFound: boolean;
  error?: string;
}

export interface HeuristicEvaluation {
  id: string;
  category: 'age' | 'downloads' | 'publisher' | 'scripts' | 'lexical';
  points: number;
  severity: 'info' | 'warning' | 'high' | 'critical';
  title: string;
  description: string;
}

export interface VettingResult {
  packageName: string;
  registry: RegistryType;
  slopScore: number; // 0 to 100
  riskLevel: RiskLevel;
  heuristics: HeuristicEvaluation[];
  metadata: PackageMetadata;
  cached: boolean;
  timestamp: number;
}

export interface InterceptedCommand {
  manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv';
  action: 'install' | 'other';
  packages: Array<{
    name: string;
    version?: string;
    registry: RegistryType;
  }>;
  rawArgs: string[];
}
