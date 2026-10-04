import { Command } from 'commander';
import pc from 'picocolors';
import { printBanner, displayVettingCard } from './ui/display.js';
import { vetPackage } from './engine/service.js';
import { runScan } from './commands/scan.js';
import { runGithubAction } from './commands/github-action.js';
import { runInstallExtension } from './commands/extension.js';
import { handleIntercept } from './commands/intercept.js';
import { vetteCache } from './cache/cache.js';
import type { RegistryType } from './types.js';

const program = new Command();

program
  .name('vette')
  .description('🛡️  Zero-latency pre-install runtime interceptor and AI slopsquatting defense')
  .version('0.1.0')
  .option('--force-unsafe', 'Bypass high-risk security blocks')
  .allowUnknownOption(true);

// 1. Standalone Vetting Command
program
  .command('vet <package>')
  .description('Inspect package reputation before installing')
  .option('-r, --registry <registry>', 'Registry to inspect (npm or pypi)', 'npm')
  .option('--no-cache', 'Bypass local reputation cache')
  .action(async (packageName: string, options: any) => {
    printBanner();
    const registry: RegistryType = options.registry.toLowerCase() === 'pypi' ? 'pypi' : 'npm';
    console.log(pc.cyan(`Vetting ${pc.bold(packageName)} on ${registry}...`));

    const result = await vetPackage(packageName, registry, {
      bypassCache: options.cache === false,
    });

    displayVettingCard(result);
    process.exit(result.riskLevel === 'DANGEROUS' ? 1 : 0);
  });

// 2. Project File Scan
program
  .command('scan [target]')
  .description('Scan package.json or requirements.txt for hallucinated / zero-day dependencies')
  .action(async (target?: string) => {
    printBanner();
    const code = await runScan(target);
    process.exit(code);
  });

// 3. GitHub Action Command
program
  .command('action')
  .alias('github-action')
  .description('Run Vette security check in GitHub Actions and output Step Summary & PR annotations')
  .action(async () => {
    printBanner();
    const code = await runGithubAction();
    process.exit(code);
  });

// 4. Install IDE Extension
program
  .command('install-extension')
  .alias('ext')
  .description('Auto-detect and install Vette extension into VS Code, Cursor, Windsurf, VSCodium')
  .action(async () => {
    const code = await runInstallExtension();
    process.exit(code);
  });

// 5. Clear Cache
program
  .command('clear-cache')
  .description('Purge the local Vette reputation cache')
  .action(() => {
    vetteCache.clear();
    console.log(pc.green('✓ Vette local reputation cache cleared.'));
    process.exit(0);
  });

// 6. Shell Integration Init
program
  .command('init')
  .description('Print shell configuration alias/shim to intercept npm/pip automatically')
  .option('--shell <type>', 'Shell type: zsh, bash, or powershell', 'powershell')
  .action((options: any) => {
    printBanner();
    console.log(pc.bold('\nTo enable automatic pre-install interception in your shell:\n'));
    if (options.shell === 'powershell' || process.platform === 'win32') {
      console.log(pc.cyan('# Add to your PowerShell $PROFILE:'));
      console.log(pc.white(`function npm { vette npm $args }\nfunction pip { vette pip $args }`));
    } else {
      console.log(pc.cyan('# Add to ~/.bashrc or ~/.zshrc:'));
      console.log(pc.white(`npm() { vette npm "$@"; }\npip() { vette pip "$@"; }`));
    }
    console.log(pc.dim('\nOnce added, all `npm install` and `pip install` commands will be vetted before execution!'));
    process.exit(0);
  });

// 7. Intercept / Passthrough Default Action
const rawArgs = process.argv.slice(2);

const knownSubcommands = [
  'vet',
  'scan',
  'action',
  'github-action',
  'install-extension',
  'ext',
  'clear-cache',
  'init',
  '--help',
  '-h',
  '--version',
  '-V',
];

if (rawArgs.length > 0 && !knownSubcommands.includes(rawArgs[0]) && !rawArgs[0].startsWith('-')) {
  const forceUnsafe = process.argv.includes('--force-unsafe');
  const filteredArgs = rawArgs.filter((a) => a !== '--force-unsafe');

  handleIntercept(filteredArgs, forceUnsafe)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(pc.red('Vette interception error:'), err);
      process.exit(1);
    });
} else {
  program.parse(process.argv);
}
