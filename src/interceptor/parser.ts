import type { InterceptedCommand, RegistryType } from '../types.js';

export function parseInterceptedCommand(args: string[]): InterceptedCommand | null {
  if (args.length === 0) return null;

  const rawArgs = [...args];
  const first = rawArgs[0].toLowerCase();

  let manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv';
  let restArgs: string[];

  if (['npm', 'pnpm', 'yarn', 'bun', 'pip', 'uv'].includes(first)) {
    manager = first as any;
    restArgs = rawArgs.slice(1);
  } else if (['install', 'add', 'i'].includes(first)) {
    // Universal shortcut: `vette install <pkg>` or `vette add <pkg>` -> default npm
    manager = 'npm';
    restArgs = rawArgs;
  } else {
    // Direct package name check or unknown
    return null;
  }

  const isPython = manager === 'pip' || manager === 'uv';
  const defaultRegistry: RegistryType = isPython ? 'pypi' : 'npm';

  // Find install subcommand
  const installVerbs = isPython ? ['install'] : ['install', 'i', 'add'];
  const hasInstallVerb = restArgs.some(arg => installVerbs.includes(arg.toLowerCase()));

  // Extract candidate package targets (ignore flags starting with - or --)
  const packages: Array<{ name: string; version?: string; registry: RegistryType }> = [];

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (installVerbs.includes(arg.toLowerCase())) continue;
    if (arg.startsWith('-')) {
      // If it takes an argument like -r requirements.txt or -c, skip next if needed
      if ((arg === '-r' || arg === '--requirement' || arg === '-f') && i + 1 < restArgs.length) {
        i++;
      }
      continue;
    }

    // Parse package name and version
    if (isPython) {
      // pip: pkg==1.0.0 or pkg>=1.0.0
      const match = arg.match(/^([a-zA-Z0-9_\-.]+)(?:([=<>!~]+)(.*))?$/);
      if (match) {
        packages.push({
          name: match[1],
          version: match[3],
          registry: 'pypi',
        });
      }
    } else {
      // npm: @scope/name@version or name@version
      let name = arg;
      let version: string | undefined;

      if (arg.startsWith('@')) {
        const parts = arg.slice(1).split('@');
        name = `@${parts[0]}`;
        if (parts.length > 1) version = parts[1];
      } else {
        const parts = arg.split('@');
        name = parts[0];
        if (parts.length > 1) version = parts[1];
      }

      if (name && !name.startsWith('.') && !name.startsWith('/')) {
        packages.push({
          name,
          version,
          registry: 'npm',
        });
      }
    }
  }

  return {
    manager,
    action: hasInstallVerb ? 'install' : 'other',
    packages,
    rawArgs,
  };
}
