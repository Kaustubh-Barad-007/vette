import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { vetPackage } from '../engine/service.js';
import type { VettingResult } from '../types.js';

interface DependencyDiff {
  name: string;
  version?: string;
  registry: 'npm' | 'pypi';
  sourceFile: string;
}

export async function runGithubAction(): Promise<number> {
  console.log(pc.bold(pc.cyan('🛡️  Vette GitHub Action: Scanning Pull Request / Commit Dependencies...')));

  // Look for dependency files in the repo
  const candidates = [
    { file: 'package.json', registry: 'npm' as const },
    { file: 'requirements.txt', registry: 'pypi' as const },
  ];

  const packagesToCheck: DependencyDiff[] = [];

  for (const candidate of candidates) {
    const fullPath = path.resolve(process.cwd(), candidate.file);
    if (!fs.existsSync(fullPath)) continue;

    if (candidate.registry === 'npm') {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const json = JSON.parse(raw);
        const allDeps = {
          ...(json.dependencies || {}),
          ...(json.devDependencies || {}),
        };
        for (const [name, ver] of Object.entries(allDeps)) {
          packagesToCheck.push({
            name,
            version: String(ver),
            registry: 'npm',
            sourceFile: candidate.file,
          });
        }
      } catch (err: any) {
        console.warn(`Failed to parse ${candidate.file}: ${err.message}`);
      }
    } else {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_\-.]+)(?:([=<>!~]+)(.*))?$/);
        if (match) {
          packagesToCheck.push({
            name: match[1],
            version: match[3],
            registry: 'pypi',
            sourceFile: candidate.file,
          });
        }
      }
    }
  }

  if (packagesToCheck.length === 0) {
    console.log(pc.green('✓ No manifest dependencies found to audit.'));
    return 0;
  }

  console.log(pc.dim(`Auditing ${packagesToCheck.length} dependencies against AI slopsquatting heuristics...\n`));

  const results: Array<{ item: DependencyDiff; result: VettingResult }> = [];

  for (const pkg of packagesToCheck) {
    const res = await vetPackage(pkg.name, pkg.registry);
    results.push({ item: pkg, result: res });
  }

  let dangerousCount = 0;
  let suspiciousCount = 0;

  // Build GitHub Step Summary and Annotations
  let markdownSummary = '## 🛡️ Vette AI Slopsquatting & Zero-Day Security Report\n\n';
  markdownSummary += '> Vet packages before they run. Pre-install protection against AI hallucinated package poisoning.\n\n';
  markdownSummary += '| Package | Registry | SlopScore | Risk Level | Age | Downloads | Signals |\n';
  markdownSummary += '| :--- | :--- | :---: | :---: | :--- | :--- | :--- |\n';

  for (const { item, result } of results) {
    const { slopScore, riskLevel, metadata, heuristics } = result;

    let badge = '🟢 Safe';
    if (riskLevel === 'DANGEROUS') {
      badge = '🔴 **DANGEROUS**';
      dangerousCount++;
      // GitHub Workflow Error Annotation
      console.log(`::error file=${item.sourceFile},title=Vette Critical Slopsquat Alert::Package "${item.name}" flagged as DANGEROUS (SlopScore: ${slopScore}/100). Zero-day slopsquatting or malicious postinstall detected!`);
    } else if (riskLevel === 'SUSPICIOUS') {
      badge = '🟡 **Suspicious**';
      suspiciousCount++;
      // GitHub Workflow Warning Annotation
      console.log(`::warning file=${item.sourceFile},title=Vette Suspicious Package::Package "${item.name}" flagged as Suspicious (SlopScore: ${slopScore}/100). High freshness or low download volume.`);
    }

    const pubDate = metadata.latestPublishedAt || metadata.createdAt;
    const ageStr = pubDate
      ? `~${Math.round((Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60 * 24))}d ago`
      : 'Unknown';

    const dlStr = item.registry === 'npm'
      ? `${metadata.downloadsLastWeek.toLocaleString()}/wk`
      : 'N/A';

    const signalsList = heuristics.map(h => h.title).slice(0, 2).join('; ') || 'None';

    markdownSummary += `| \`${item.name}\` | \`${item.registry}\` | **${slopScore}/100** | ${badge} | ${ageStr} | ${dlStr} | ${signalsList} |\n`;
  }

  // Summary footer
  markdownSummary += '\n### Executive Summary\n';
  markdownSummary += `- **Total Checked:** ${results.length}\n`;
  markdownSummary += `- **Critical / Dangerous:** ${dangerousCount}\n`;
  markdownSummary += `- **Suspicious:** ${suspiciousCount}\n`;
  markdownSummary += `- **Safe:** ${results.length - dangerousCount - suspiciousCount}\n\n`;

  if (dangerousCount > 0) {
    markdownSummary += '> ❌ **Action Required:** One or more packages were flagged with critical risk. Pull request build failed to prevent supply chain poisoning.\n';
  } else if (suspiciousCount > 0) {
    markdownSummary += '> ⚠️ **Notice:** Suspicious packages detected with low traction or recent publication dates. Please review carefully.\n';
  } else {
    markdownSummary += '> ✅ **All dependencies verified safe.** No AI hallucinated slopsquats or zero-day poisoning traits detected.\n';
  }

  // Write to GITHUB_STEP_SUMMARY if available
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, markdownSummary);
      console.log(pc.green('✓ GitHub Step Summary updated successfully.'));
    } catch (err: any) {
      console.warn(`Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  // Print terminal output
  console.log('\n' + markdownSummary);

  if (dangerousCount > 0) {
    console.log(pc.red(pc.bold(`\n✖ Vette failed with ${dangerousCount} dangerous package(s). Build aborted.`)));
    return 1;
  }

  console.log(pc.green(pc.bold('\n✓ Vette audit passed. No malicious slopsquats detected.')));
  return 0;
}
