import pc from 'picocolors';
import type { VettingResult } from '../types.js';

export function printBanner(): void {
  console.log(
    pc.bold(pc.cyan('🛡️  Vette')) +
    pc.dim(' v0.1.0 · Zero-Day & AI Slopsquatting Defense')
  );
}

export function renderScoreGauge(score: number): string {
  const totalBars = 10;
  const filled = Math.min(10, Math.max(0, Math.round((score / 100) * totalBars)));
  const empty = totalBars - filled;

  let colorFn = pc.green;
  let label = 'SAFE';

  if (score >= 70) {
    colorFn = pc.red;
    label = 'CRITICAL RISK';
  } else if (score >= 30) {
    colorFn = pc.yellow;
    label = 'SUSPICIOUS';
  }

  const bar = colorFn('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
  return `${bar} ${colorFn(pc.bold(`${score}/100`))} ${pc.dim(`(${label})`)}`;
}

export function displayVettingCard(result: VettingResult): void {
  const { packageName, registry, slopScore, riskLevel, heuristics, metadata, cached } = result;

  const width = 62;
  const borderLine = pc.dim('─'.repeat(width));

  console.log('\n' + borderLine);

  // Status Pill & Title
  if (riskLevel === 'DANGEROUS') {
    console.log(
      pc.bgRed(pc.white(pc.bold(' ✖ BLOCKED '))) + ' ' +
      pc.bold(pc.red(packageName)) + ' ' +
      pc.dim(`(${registry})`) +
      (cached ? pc.dim(' · cached') : '')
    );
  } else if (riskLevel === 'SUSPICIOUS') {
    console.log(
      pc.bgYellow(pc.black(pc.bold(' ⚠ WARNING '))) + ' ' +
      pc.bold(pc.yellow(packageName)) + ' ' +
      pc.dim(`(${registry})`) +
      (cached ? pc.dim(' · cached') : '')
    );
  } else {
    console.log(
      pc.bgGreen(pc.black(pc.bold(' ✓ VERIFIED '))) + ' ' +
      pc.bold(pc.green(packageName)) + ' ' +
      pc.dim(`(${registry})`) +
      (cached ? pc.dim(' · cached') : '')
    );
  }

  // SlopScore Gauge
  console.log(pc.dim('  Threat Score: ') + renderScoreGauge(slopScore));

  // Package Overview Details
  const pubDate = metadata.latestPublishedAt || metadata.createdAt;
  if (pubDate) {
    const ageHours = Math.round((Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60));
    const ageDays = (ageHours / 24).toFixed(1);
    const ageColor = ageHours < 72 ? pc.red : pc.white;
    console.log(
      pc.dim('  Published:    ') +
      ageColor(`${ageDays} days ago (~${ageHours}h)`) +
      (ageHours < 72 ? pc.red(' [FRESH]') : '')
    );
  }

  if (registry === 'npm') {
    const dlColor = metadata.downloadsLastWeek === 0 ? pc.red : pc.white;
    console.log(
      pc.dim('  Downloads:    ') +
      dlColor(`${metadata.downloadsLastWeek.toLocaleString()} last week`)
    );
  }

  if (metadata.hasInstallScripts) {
    console.log(
      pc.dim('  Install Hook: ') +
      pc.red(pc.bold(`Active (${Object.keys(metadata.installScripts).join(', ')}) - RUNS ARBITRARY CODE`))
    );
  }

  // Security Signals Breakdown
  if (heuristics.length > 0) {
    console.log('\n' + pc.bold('  Detected Signals:'));
    for (const h of heuristics) {
      let icon = pc.cyan('·');
      let titleColor = pc.cyan;

      if (h.severity === 'critical') {
        icon = pc.red('✖');
        titleColor = pc.red;
      } else if (h.severity === 'high') {
        icon = pc.red('▲');
        titleColor = pc.red;
      } else if (h.severity === 'warning') {
        icon = pc.yellow('⚠');
        titleColor = pc.yellow;
      }

      const pts = h.points > 0 ? `+${h.points}` : `${h.points}`;
      console.log(`    ${icon} ${titleColor(pc.bold(h.title))} ${pc.dim(`[${pts} pts]`)}`);
      console.log(`      ${pc.dim(h.description)}`);
    }
  }

  // Clear Actionable Verdict
  if (riskLevel === 'DANGEROUS') {
    console.log(
      '\n  ' + pc.bgRed(pc.white(pc.bold(' ACTION '))) + ' ' +
      pc.red(pc.bold('Installation prevented.')) + ' ' +
      pc.dim('Lifecycle scripts were blocked from running.')
    );
  } else if (riskLevel === 'SUSPICIOUS') {
    console.log(
      '\n  ' + pc.bgYellow(pc.black(pc.bold(' ACTION '))) + ' ' +
      pc.yellow('Review author and source carefully before continuing.')
    );
  }

  console.log(borderLine + '\n');
}
