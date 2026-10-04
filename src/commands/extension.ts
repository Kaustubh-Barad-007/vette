import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import pc from 'picocolors';

export async function runInstallExtension(): Promise<number> {
  console.log(pc.bold(pc.cyan('\n🛡️  Vette Universal IDE Extension Installer')));
  console.log(pc.dim('Detecting installed editors (VS Code, Cursor, Windsurf, VSCodium)...\n'));

  // Look for bundled VSIX in repo or fallback download
  let vsixPath = path.resolve(__dirname, '../extension/vette-vscode-0.1.0.vsix');
  if (!fs.existsSync(vsixPath)) {
    vsixPath = path.resolve(process.cwd(), 'extension/vette-vscode-0.1.0.vsix');
  }

  if (!fs.existsSync(vsixPath)) {
    console.log(pc.yellow('⬇️  Downloading extension VSIX from GitHub...'));
    const tempFile = path.join(os.tmpdir(), 'vette-vscode.vsix');
    try {
      const url = 'https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/extension/vette-vscode-0.1.0.vsix';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(buffer));
      vsixPath = tempFile;
    } catch (err: any) {
      console.error(pc.red(`Failed to download extension: ${err.message}`));
      return 1;
    }
  }

  const editors = ['code', 'cursor', 'windsurf', 'codium'];
  let installedCount = 0;

  for (const editor of editors) {
    try {
      // Check if command exists
      const checkCmd = process.platform === 'win32' ? `where.exe ${editor}` : `which ${editor}`;
      execSync(checkCmd, { stdio: 'ignore' });

      process.stdout.write(`Installing into ${pc.bold(editor)}... `);
      const installCmd = `${editor} --install-extension "${vsixPath}" --force`;
      execSync(installCmd, { stdio: 'ignore' });
      console.log(pc.green(pc.bold('[SUCCESS]')));
      installedCount++;
    } catch {
      // Editor not installed on PATH
    }
  }

  if (installedCount > 0) {
    console.log(pc.green(pc.bold(`\n✓ Vette successfully activated in ${installedCount} editor(s)!`)));
    console.log(pc.dim('Open package.json or requirements.txt to see real-time AI slopsquat protection active.\n'));
    return 0;
  }

  console.log(pc.yellow('No supported editor CLI (code, cursor, windsurf, codium) was found on your PATH.'));
  console.log(pc.white(`You can install manually by running: ${pc.cyan(`code --install-extension "${vsixPath}"`)}\n`));
  return 0;
}
