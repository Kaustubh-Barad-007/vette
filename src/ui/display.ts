import pc from 'picocolors';
import type { VettingResult } from '../types.js';

export function printBanner(): void {
  console.log(
    pc.bold(pc.cyan('🛡️  Vette')) +
    pc.dim(' v0.1.0 — Pre-install AI Slopsquatting & Zero-Day Interceptor')
  );
}

export function renderScoreGauge(score: number): string {
  const totalBars = 10;
  const filled = Math.round((score / 100) * totalBars);
  const empty = totalBars - filled;

  let colorFn = pc.green;
  if (score >= 70) colorFn = pc.red;
  else if (score >= 30) colorFn = pc.yellow;

  const bar = colorFn('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
  return `[${bar}] ${colorFn(pc.bold(`${score}/100`))}`;
}

export function displayVettingCard(result: VettingResult): void {
  const { packageName, registry, slopScore, riskLevel, heuristics, metadata, cached } = result;

  console.log('\n' + '─'.repeat(64));
  
  let header = '';
  if (riskLevel === 'DANGEROUS') {
    header = pc.bgRed(pc.white(pc.bold(' ⚠️  CRITICAL RISK DETECTED '))) + ' ' + pc.bold(pc.red(packageName));
  } else if (riskLevel === 'SUSPICIOUS') {
    header = pc.bgYellow(pc.black(pc.bold(' ⚠️  SUSPICIOUS PACKAGE '))) + ' ' + pc.bold(pc.yellow(packageName));
  } else {
    header = pc.bgGreen(pc.black(pc.bold(' ✓ VERIFIED SAFE '))) + ' ' + pc.bold(pc.green(packageName));
  }

  console.log(header + pc.dim(` (${registry})`));
  console.log(
    pc.dim('SlopScore: ') +
    renderScoreGauge(slopScore) +
    pc.dim(` [${riskLevel}]`) +
    (cached ? pc.dim(' (from cache)') : '')
  );

  // Package summary
  if (metadata.latestVersion) {
    console.log(pc.dim('Version:   ') + pc.cyan(metadata.latestVersion));
  }

  const pubDate = metadata.latestPublishedAt || metadata.createdAt;
  if (pubDate) {
    const ageHours = Math.round((Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60));
    const ageDays = (ageHours / 24).toFixed(1);
    const ageColor = ageHours < 72 ? pc.red : pc.green;
    console.log(
      pc.dim('Published: ') +
      ageColor(`${pubDate} (~${ageHours}h / ${ageDays}d ago)`)
    );
  }

  if (registry === 'npm') {
    const dlColor = metadata.downloadsLastWeek === 0 ? pc.red : pc.cyan;
    console.log(
      pc.dim('Downloads: ') +
      dlColor(`${metadata.downloadsLastWeek.toLocaleString()} last week`)
    );
  }

  if (metadata.author?.name) {
    console.log(pc.dim('Author:    ') + pc.white(metadata.author.name) + (metadata.author.email ? pc.dim(` <${metadata.author.email}>`) : ''));
  }

  if (metadata.hasInstallScripts) {
    console.log(
      pc.bold(pc.red('Hooks:     ')) +
      pc.red(pc.bold(Object.keys(metadata.installScripts).join(', ') + ' (EXECUTES CODE ON HOST)'))
    );
  }

  // Heuristics Breakdown
  if (heuristics.length > 0) {
    console.log('\n' + pc.bold('Security Signals & Heuristics:'));
    for (const h of heuristics) {
      let icon = pc.cyan('ℹ');
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
      console.log(`  ${icon} ${titleColor(pc.bold(h.title))} ${pc.dim(`[${pts} pts]`)}`);
      console.log(`     ${pc.dim(h.description)}`);
    }
  }

  console.log('─'.repeat(64) + '\n');
}
