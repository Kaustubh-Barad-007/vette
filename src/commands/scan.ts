import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { vetPackage } from '../engine/service.js';
import { displayVettingCard } from '../ui/display.js';
import type { VettingResult } from '../types.js';

export async function runScan(targetPath?: string): Promise<number> {
  const file = targetPath || 'package.json';
  const fullPath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(fullPath)) {
    console.error(pc.red(`Target file not found: ${fullPath}`));
    return 1;
  }

  console.log(pc.cyan(`\n🔍 Vette scanning: ${pc.bold(file)}...`));

  const isPython = file.endsWith('.txt') || file.includes('requirements');
  const packagesToScan: Array<{ name: string; registry: 'npm' | 'pypi' }> = [];

  if (isPython) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([a-zA-Z0-9_\-.]+)/);
      if (match) {
        packagesToScan.push({ name: match[1], registry: 'pypi' });
      }
    }
  } else {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const pkgJson = JSON.parse(raw);
      const allDeps = {
        ...(pkgJson.dependencies || {}),
        ...(pkgJson.devDependencies || {}),
      };

      for (const name of Object.keys(allDeps)) {
        packagesToScan.push({ name, registry: 'npm' });
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to parse ${file}: ${err.message}`));
      return 1;
    }
  }

  if (packagesToScan.length === 0) {
    console.log(pc.yellow('No dependencies found to scan.'));
    return 0;
  }

  console.log(pc.dim(`Found ${packagesToScan.length} dependencies. Checking real-time registry reputation...\n`));

  const results: VettingResult[] = [];
  const start = Date.now();

  // Concurrently inspect with chunking to avoid slamming registry
  const chunkSize = 10;
  for (let i = 0; i < packagesToScan.length; i += chunkSize) {
    const chunk = packagesToScan.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(pkg => vetPackage(pkg.name, pkg.registry))
    );
    results.push(...chunkResults);
  }

  const duration = Date.now() - start;
  let dangerousCount = 0;
  let suspiciousCount = 0;

  for (const r of results) {
    if (r.riskLevel === 'DANGEROUS') {
      dangerousCount++;
      displayVettingCard(r);
    } else if (r.riskLevel === 'SUSPICIOUS') {
      suspiciousCount++;
      displayVettingCard(r);
    }
  }

  console.log('═'.repeat(64));
  console.log(
    pc.bold('Scan Complete in ') + pc.cyan(`${duration}ms`) +
    pc.dim(` (${results.length} packages scanned)`)
  );
  console.log(
    `Status: ` +
    (dangerousCount > 0 ? pc.red(pc.bold(`${dangerousCount} Dangerous`)) : pc.green('0 Dangerous')) + ' | ' +
    (suspiciousCount > 0 ? pc.yellow(pc.bold(`${suspiciousCount} Suspicious`)) : pc.green('0 Suspicious')) + ' | ' +
    pc.green(`${results.length - dangerousCount - suspiciousCount} Safe`)
  );
  console.log('═'.repeat(64) + '\n');

  if (dangerousCount > 0) {
    console.log(pc.red(pc.bold('✖ Scan failed: High-risk slopsquatting or dangerous hooks detected.')));
    return 1;
  }

  console.log(pc.green(pc.bold('✓ All dependencies passed Vette security verification.')));
  return 0;
}
