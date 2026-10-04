import * as vscode from 'vscode';

// Types and In-memory cache for extension
interface VettingSummary {
  name: string;
  registry: 'npm' | 'pypi';
  slopScore: number;
  riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  ageHours?: number;
  downloadsLastWeek: number;
  authorName?: string;
  hasInstallScripts: boolean;
  isNotFound: boolean;
  signals: string[];
}

const memoryCache = new Map<string, { data: VettingSummary; expires: number }>();

async function inspectPackageOnline(name: string, registry: 'npm' | 'pypi'): Promise<VettingSummary> {
  const cacheKey = `${registry}:${name.toLowerCase()}`;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const signals: string[] = [];
  let slopScore = 0;
  let ageHours: number | undefined;
  let downloadsLastWeek = 0;
  let authorName: string | undefined;
  let hasInstallScripts = false;
  let isNotFound = false;

  try {
    if (registry === 'npm') {
      const cleanName = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
      const [metaRes, dlRes] = await Promise.allSettled([
        fetch(`https://registry.npmjs.org/${cleanName}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) }),
        fetch(`https://api.npmjs.org/downloads/point/last-week/${cleanName}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) }),
      ]);

      if (metaRes.status === 'fulfilled' && metaRes.value.status === 404) {
        isNotFound = true;
        slopScore = 85;
        signals.push('Unregistered / Hallucinated Package (+85 pts)');
      } else if (metaRes.status === 'fulfilled' && metaRes.value.ok) {
        const data = (await metaRes.value.json()) as any;
        const latestTag = data['dist-tags']?.latest;
        const verObj = latestTag ? data.versions?.[latestTag] : null;

        if (verObj?.scripts && (verObj.scripts.preinstall || verObj.scripts.postinstall || verObj.scripts.install)) {
          hasInstallScripts = true;
          slopScore += 25;
          signals.push('Contains lifecycle pre/postinstall hooks (+25 pts)');
        }

        const pubTime = (latestTag && data.time?.[latestTag]) || data.time?.created;
        if (pubTime) {
          ageHours = (Date.now() - new Date(pubTime).getTime()) / (1000 * 60 * 60);
          if (ageHours < 24) {
            slopScore += 35;
            signals.push(`Extremely fresh: published ${Math.round(ageHours)}h ago (+35 pts)`);
          } else if (ageHours < 72) {
            slopScore += 25;
            signals.push(`Published <72h ago (+25 pts)`);
          }
        }

        if (dlRes.status === 'fulfilled' && dlRes.value.ok) {
          const dlData = (await dlRes.value.json()) as any;
          downloadsLastWeek = Number(dlData.downloads) || 0;
        }

        if (downloadsLastWeek === 0) {
          slopScore += 25;
          signals.push('Zero weekly downloads (+25 pts)');
        } else if (downloadsLastWeek < 50) {
          slopScore += 15;
          signals.push('Very low download count (<50/wk) (+15 pts)');
        } else if (downloadsLastWeek > 10000) {
          slopScore = Math.max(0, slopScore - 25);
          signals.push('Established community adoption (-25 pts)');
        }

        authorName = data.author?.name || (data.maintainers?.[0]?.name);
      }
    } else {
      // PyPI
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name.toLowerCase())}/json`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (res.status === 404) {
        isNotFound = true;
        slopScore = 85;
        signals.push('Unregistered / Hallucinated Package on PyPI (+85 pts)');
      } else if (res.ok) {
        const data = (await res.json()) as any;
        const latestVersion = data.info?.version;
        const releaseFiles = data.releases?.[latestVersion] || [];
        if (releaseFiles.length > 0 && releaseFiles[0].upload_time_iso_8601) {
          ageHours = (Date.now() - new Date(releaseFiles[0].upload_time_iso_8601).getTime()) / (1000 * 60 * 60);
          if (ageHours < 24) {
            slopScore += 35;
            signals.push(`Extremely fresh: published ${Math.round(ageHours)}h ago (+35 pts)`);
          } else if (ageHours < 72) {
            slopScore += 25;
            signals.push(`Published <72h ago (+25 pts)`);
          }
        }
        authorName = data.info?.author || data.info?.maintainer;
      }
    }
  } catch {
    // Network offline fallback
  }

  slopScore = Math.min(100, Math.max(0, slopScore));
  let riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' = 'SAFE';
  if (slopScore >= 70) riskLevel = 'DANGEROUS';
  else if (slopScore >= 30) riskLevel = 'SUSPICIOUS';

  const result: VettingSummary = {
    name,
    registry,
    slopScore,
    riskLevel,
    ageHours,
    downloadsLastWeek,
    authorName,
    hasInstallScripts,
    isNotFound,
    signals,
  };

  memoryCache.set(cacheKey, {
    data: result,
    expires: now + (riskLevel === 'SAFE' ? 1000 * 60 * 60 * 24 : 1000 * 60 * 15),
  });

  return result;
}

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('vette');
  context.subscriptions.push(diagnosticCollection);

  // Status Bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(shield) Vette';
  statusBar.tooltip = 'Vette: AI Slopsquatting & Package Guard Active';
  statusBar.command = 'vette.scanWorkspace';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Document analysis
  async function auditDocument(document: vscode.TextDocument) {
    const filename = document.fileName.toLowerCase();
    const isPackageJson = filename.endsWith('package.json');
    const isRequirements = filename.endsWith('requirements.txt');

    if (!isPackageJson && !isRequirements) return;

    const config = vscode.workspace.getConfiguration('vette');
    if (!config.get<boolean>('enableInlineDiagnostics', true)) {
      diagnosticCollection.delete(document.uri);
      return;
    }

    const threshold = config.get<number>('riskThreshold', 30);
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    if (isPackageJson) {
      let inDeps = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
          inDeps = true;
          continue;
        }
        if (inDeps && line.trim().startsWith('}')) {
          inDeps = false;
          continue;
        }

        if (inDeps) {
          const match = line.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
          if (match) {
            const pkgName = match[1];
            const summary = await inspectPackageOnline(pkgName, 'npm');

            if (summary.slopScore >= threshold) {
              const startCol = line.indexOf(`"${pkgName}"`);
              const range = new vscode.Range(i, startCol + 1, i, startCol + 1 + pkgName.length);
              const severity = summary.riskLevel === 'DANGEROUS'
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning;

              const message = summary.isNotFound
                ? `🚨 Vette: '${pkgName}' does not exist on npm! This is likely an AI hallucination. Attackers frequently register these with malicious payloads.`
                : `⚠️ Vette: '${pkgName}' has high SlopScore (${summary.slopScore}/100 - ${summary.riskLevel}). Signals: ${summary.signals.join(', ')}`;

              const diag = new vscode.Diagnostic(range, message, severity);
              diag.source = 'Vette Security';
              diagnostics.push(diag);
            }
          }
        }
      }
    } else if (isRequirements) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^([a-zA-Z0-9_\-.]+)/);
        if (match) {
          const pkgName = match[1];
          const summary = await inspectPackageOnline(pkgName, 'pypi');

          if (summary.slopScore >= threshold) {
            const range = new vscode.Range(i, 0, i, pkgName.length);
            const severity = summary.riskLevel === 'DANGEROUS'
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning;

            const message = summary.isNotFound
              ? `🚨 Vette: '${pkgName}' does not exist on PyPI! Likely an AI hallucination.`
              : `⚠️ Vette: '${pkgName}' SlopScore: ${summary.slopScore}/100. Signals: ${summary.signals.join(', ')}`;

            const diag = new vscode.Diagnostic(range, message, severity);
            diag.source = 'Vette Security';
            diagnostics.push(diag);
          }
        }
      }
    }

    diagnosticCollection.set(document.uri, diagnostics);
  }

  // Hover Provider
  const hoverProvider = vscode.languages.registerHoverProvider(['json', 'jsonc', 'pip-requirements', 'plaintext'], {
    async provideHover(document, position) {
      const filename = document.fileName.toLowerCase();
      const isPkg = filename.endsWith('package.json');
      const isReq = filename.endsWith('requirements.txt');
      if (!isPkg && !isReq) return null;

      const line = document.lineAt(position.line).text;
      let pkgName = '';
      let registry: 'npm' | 'pypi' = 'npm';

      if (isPkg) {
        const match = line.match(/"([^"]+)"\s*:\s*"[^"]+"/);
        if (match) {
          const startCol = line.indexOf(`"${match[1]}"`);
          if (position.character >= startCol && position.character <= startCol + match[1].length + 2) {
            pkgName = match[1];
            registry = 'npm';
          }
        }
      } else {
        const match = line.trim().match(/^([a-zA-Z0-9_\-.]+)/);
        if (match && position.character <= match[1].length) {
          pkgName = match[1];
          registry = 'pypi';
        }
      }

      if (!pkgName) return null;

      const summary = await inspectPackageOnline(pkgName, registry);

      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.appendMarkdown(`### 🛡️ Vette Security: \`${summary.name}\` (${summary.registry})\n\n`);

      let badge = '🟢 **VERIFIED SAFE**';
      if (summary.riskLevel === 'DANGEROUS') badge = '🔴 **CRITICAL SLOP RISK**';
      else if (summary.riskLevel === 'SUSPICIOUS') badge = '🟡 **SUSPICIOUS**';

      md.appendMarkdown(`**Status:** ${badge} &nbsp;|&nbsp; **SlopScore:** \`${summary.slopScore}/100\`\n\n`);

      if (summary.isNotFound) {
        md.appendMarkdown(`> 🚨 **AI Hallucination Alert:** This package is **unregistered** on the public registry. Attackers write automated crawlers to register hallucinated names with malicious \`postinstall\` scripts!\n\n`);
      } else {
        if (summary.ageHours !== undefined) {
          const days = (summary.ageHours / 24).toFixed(1);
          md.appendMarkdown(`- **Age:** ~${Math.round(summary.ageHours)} hours (~${days} days ago)\n`);
        }
        if (registry === 'npm') {
          md.appendMarkdown(`- **Weekly Downloads:** ${summary.downloadsLastWeek.toLocaleString()}\n`);
        }
        if (summary.authorName) {
          md.appendMarkdown(`- **Author:** ${summary.authorName}\n`);
        }
        if (summary.hasInstallScripts) {
          md.appendMarkdown(`- **⚠️ Lifecycle Hooks:** Contains \`preinstall\` or \`postinstall\` scripts that execute arbitrary shell commands!\n`);
        }
      }

      if (summary.signals.length > 0) {
        md.appendMarkdown(`\n**Signals:**\n`);
        for (const sig of summary.signals) {
          md.appendMarkdown(`- ${sig}\n`);
        }
      }

      md.appendMarkdown(`\n---\n*Vetted by Vette Pre-Install Guard*`);
      return new vscode.Hover(md);
    },
  });

  context.subscriptions.push(hoverProvider);

  // Event Listeners with Debounce
  let debounceTimeout: NodeJS.Timeout | undefined;
  function triggerAudit(doc: vscode.TextDocument) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => auditDocument(doc), 300);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(auditDocument),
    vscode.workspace.onDidSaveTextDocument(auditDocument),
    vscode.workspace.onDidChangeTextDocument(e => triggerAudit(e.document))
  );

  // Initial audit for currently active editor
  if (vscode.window.activeTextEditor) {
    auditDocument(vscode.window.activeTextEditor.document);
  }

  // Scan Command
  context.subscriptions.push(
    vscode.commands.registerCommand('vette.scanWorkspace', async () => {
      vscode.window.showInformationMessage('🛡️ Vette scanning workspace for AI-hallucinated packages...');
      if (vscode.window.activeTextEditor) {
        await auditDocument(vscode.window.activeTextEditor.document);
        vscode.window.showInformationMessage('✓ Vette scan completed!');
      }
    }),
    vscode.commands.registerCommand('vette.clearCache', () => {
      memoryCache.clear();
      vscode.window.showInformationMessage('✓ Vette cache cleared.');
    })
  );
}

export function deactivate() {}
