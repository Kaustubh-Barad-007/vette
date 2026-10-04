import { spawn } from 'node:child_process';

export function runPassthroughCommand(manager: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    // On Windows, npm is npm.cmd
    const cmd = process.platform === 'win32' && manager === 'npm' ? 'npm.cmd' : manager;

    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to execute ${manager}:`, err.message);
      resolve(1);
    });
  });
}
