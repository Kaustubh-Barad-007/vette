import readline from 'node:readline';
import pc from 'picocolors';
import { parseInterceptedCommand } from '../interceptor/parser.js';
import { vetPackage } from '../engine/service.js';
import { displayVettingCard } from '../ui/display.js';
import { runPassthroughCommand } from '../interceptor/runner.js';
import type { VettingResult } from '../types.js';

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export async function handleIntercept(rawArgs: string[], forceUnsafe: boolean = false): Promise<number> {
  const parsed = parseInterceptedCommand(rawArgs);

  // If not a recognized package manager install command, just pass through
  if (!parsed || parsed.action !== 'install' || parsed.packages.length === 0) {
    const manager = parsed?.manager || rawArgs[0] || 'npm';
    const rest = parsed ? rawArgs.slice(1) : rawArgs.slice(1);
    return runPassthroughCommand(manager, rest);
  }

  console.log(pc.cyan(`🛡️  Vette inspecting ${parsed.packages.length} package(s) before execution...`));

  const results: VettingResult[] = [];
  for (const pkg of parsed.packages) {
    const res = await vetPackage(pkg.name, pkg.registry);
    results.push(res);
  }

  let hasDangerous = false;
  let hasSuspicious = false;

  for (const res of results) {
    if (res.riskLevel === 'DANGEROUS') {
      hasDangerous = true;
      displayVettingCard(res);
    } else if (res.riskLevel === 'SUSPICIOUS') {
      hasSuspicious = true;
      displayVettingCard(res);
    }
  }

  // Handle DANGEROUS packages
  if (hasDangerous) {
    if (forceUnsafe) {
      console.log(pc.yellow('\n⚠️  Bypassing critical security block due to --force-unsafe flag!'));
    } else {
      console.log(
        pc.bgRed(pc.white(pc.bold(' 🚨 EXECUTION BLOCKED BY VETTE 🚨 '))) + '\n' +
        pc.red(pc.bold('High risk of AI Slopsquatting / Zero-Day poisoning detected!')) + '\n' +
        pc.dim('Pre-install lifecycle scripts were prevented from running on your machine.') + '\n' +
        pc.dim('If you are certain this package is legitimate, rerun with: ') +
        pc.cyan(`vette --force-unsafe ${rawArgs.join(' ')}\n`)
      );
      return 1;
    }
  }

  // Handle SUSPICIOUS packages
  if (hasSuspicious && !hasDangerous && !forceUnsafe) {
    const proceed = await askConfirmation(
      pc.bold(pc.yellow('⚠️  Package flagged as suspicious. Do you wish to continue with installation? [y/N]: '))
    );

    if (!proceed) {
      console.log(pc.red('\n✖ Installation aborted safely. Host was not modified.\n'));
      return 0;
    }
  }

  // All safe or approved: Run the native package manager command
  const [manager, ...rest] = rawArgs;
  return runPassthroughCommand(manager, rest);
}
