import type { PackageMetadata, HeuristicEvaluation } from '../types.js';

// Common base technology roots that LLMs append hallucinated utilities to
const FAMOUS_ROOTS = [
  'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
  'express', 'fastify', 'koa', 'nestjs', 'trpc',
  'langchain', 'openai', 'anthropic', 'gemini', 'transformers',
  'aws', 'azure', 'gcp', 'supabase', 'firebase', 'prisma',
  'tailwind', 'stripe', 'auth0', 'jwt', 'boto3', 'fastapi',
  'django', 'flask', 'pydantic', 'pandas', 'numpy', 'scikit'
];

// Typical generic suffixes hallucinated by LLMs
const HALLUCINATION_TOKENS = [
  'utils', 'util', 'helper', 'helpers', 'tools', 'tool',
  'wrapper', 'connector', 'bridge', 'crypto', 'secure',
  'security', 'client', 'bearer', 'validator', 'kit',
  'manager', 'sdk', 'core-utils', 'auth-bearer', 'provider'
];

// Suspicious shell execution patterns in postinstall/preinstall
const DANGEROUS_COMMAND_PATTERNS = [
  /curl\s+/i,
  /wget\s+/i,
  /powershell/i,
  /cmd\.exe/i,
  /sh\s+-c/i,
  /bash\s+/i,
  /node\s+-e/i,
  /base64/i,
  /eval\(/i,
  /exec\(/i,
  /spawn\(/i,
  /socket/i,
  /fetch\(/i,
  /http/i,
  /discordapp\.com\/api\/webhooks/i,
  /telegram\.org\/bot/i
];

export function evaluatePackageHeuristics(metadata: PackageMetadata): HeuristicEvaluation[] {
  const evaluations: HeuristicEvaluation[] = [];

  // 1. Package Not Found (Pure Hallucination Detection)
  if (metadata.isNotFound) {
    evaluations.push({
      id: 'NOT_FOUND',
      category: 'lexical',
      points: 85,
      severity: 'critical',
      title: 'Unregistered / Hallucinated Package',
      description: `Package '${metadata.name}' does not exist on ${metadata.registry}. Attackers often monitor and register such names after LLMs hallucinate them!`,
    });
    return evaluations;
  }

  const now = Date.now();
  const pubTime = metadata.latestPublishedAt || metadata.createdAt;
  const ageMs = pubTime ? now - new Date(pubTime).getTime() : null;
  const ageHours = ageMs !== null ? ageMs / (1000 * 60 * 60) : null;
  const ageDays = ageHours !== null ? ageHours / 24 : null;

  // 2. Age & Freshness Heuristics
  if (ageHours !== null && ageHours < 24) {
    evaluations.push({
      id: 'EXTREME_FRESHNESS',
      category: 'age',
      points: 35,
      severity: 'critical',
      title: 'Extremely Fresh Package (<24h)',
      description: `Published only ${Math.round(ageHours)} hours ago. High correlation with zero-day slopsquatting.`,
    });
  } else if (ageHours !== null && ageHours < 72) {
    evaluations.push({
      id: 'HIGH_FRESHNESS',
      category: 'age',
      points: 25,
      severity: 'high',
      title: 'Fresh Package (<72h)',
      description: `Published ${Math.round(ageHours)} hours ago (${Math.round(ageDays!)} days ago). CVE databases will not have caught malicious activity yet.`,
    });
  } else if (ageDays !== null && ageDays < 7) {
    evaluations.push({
      id: 'RECENT_PUBLISH',
      category: 'age',
      points: 15,
      severity: 'warning',
      title: 'Recently Published (<7 days)',
      description: `Published ${Math.round(ageDays)} days ago. Still within zero-day incubation period.`,
    });
  } else if (ageDays !== null && ageDays > 180) {
    evaluations.push({
      id: 'MATURE_PACKAGE',
      category: 'age',
      points: -15,
      severity: 'info',
      title: 'Mature Package History',
      description: `First created over ${Math.round(ageDays)} days ago. Established ecosystem presence.`,
    });
  }

  // 3. Download Velocity & Social Proof (primarily for npm)
  if (metadata.registry === 'npm') {
    if (metadata.downloadsLastWeek === 0) {
      evaluations.push({
        id: 'ZERO_DOWNLOADS',
        category: 'downloads',
        points: 25,
        severity: 'high',
        title: 'Zero Weekly Downloads',
        description: 'No community adoption or real-world verification found.',
      });
    } else if (metadata.downloadsLastWeek < 50) {
      evaluations.push({
        id: 'MINIMAL_DOWNLOADS',
        category: 'downloads',
        points: 15,
        severity: 'warning',
        title: 'Very Low Downloads (<50/week)',
        description: `Only ${metadata.downloadsLastWeek} downloads recorded in the past week.`,
      });
    } else if (metadata.downloadsLastWeek > 10000) {
      evaluations.push({
        id: 'HIGH_COMMUNITY_TRUST',
        category: 'downloads',
        points: -25,
        severity: 'info',
        title: 'Strong Community Adoption',
        description: `${metadata.downloadsLastWeek.toLocaleString()} weekly downloads. Broad community testing reduces slopsquat risk.`,
      });
    }
  }

  // 4. Lifecycle Script Threat (preinstall, postinstall, install hooks)
  if (metadata.hasInstallScripts) {
    let scriptSeverity: 'warning' | 'high' | 'critical' = 'high';
    let scriptPoints = 25;
    const dangerousCommandsFound: string[] = [];

    for (const [scriptName, scriptContent] of Object.entries(metadata.installScripts)) {
      for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(scriptContent)) {
          dangerousCommandsFound.push(`${scriptName}: ${scriptContent.slice(0, 60)}...`);
          scriptSeverity = 'critical';
          scriptPoints = 40;
          break;
        }
      }
    }

    evaluations.push({
      id: 'LIFECYCLE_SCRIPTS_DETECTED',
      category: 'scripts',
      points: scriptPoints,
      severity: scriptSeverity,
      title: dangerousCommandsFound.length > 0 
        ? 'Dangerous Post-Install Commands Detected!' 
        : 'Lifecycle Scripts Present (pre/postinstall)',
      description: dangerousCommandsFound.length > 0
        ? `Found shell execution / network commands: ${dangerousCommandsFound.join('; ')}`
        : `Package contains install hooks (${Object.keys(metadata.installScripts).join(', ')}). These run automatically upon install.`,
    });
  }

  // 5. Publisher Profile
  if (metadata.maintainers.length <= 1) {
    evaluations.push({
      id: 'SINGLE_MAINTAINER',
      category: 'publisher',
      points: 10,
      severity: 'info',
      title: 'Single Maintainer',
      description: 'Single author control with no organization or team oversight.',
    });
  }

  // 6. Lexical AI Hallucination & Slopsquatting Pattern Check
  const normalizedName = metadata.name.toLowerCase().replace(/[@/]/g, '-');
  const matchedRoot = FAMOUS_ROOTS.find(root => normalizedName.includes(root));
  const matchedToken = HALLUCINATION_TOKENS.find(token => normalizedName.includes(token));

  if (matchedRoot && matchedToken && !metadata.name.startsWith('@')) {
    evaluations.push({
      id: 'AI_SLOP_LEXICAL_MATCH',
      category: 'lexical',
      points: 20,
      severity: 'high',
      title: 'Matches AI Hallucination Pattern',
      description: `Combines brand root '${matchedRoot}' with generic token '${matchedToken}' without official scope. Common in LLM slopsquats.`,
    });
  }

  return evaluations;
}
