<div align="center">

# 🛡️ Vette

### Don't just audit known CVEs. Vet packages before they run.

**The zero-latency, pre-install runtime interceptor defending against AI "Slopsquatting", hallucinated package poisoning, and zero-day supply chain attacks.**

[![CI Matrix](https://img.shields.io/badge/CI-Passing-success?style=flat-square&logo=githubactions)](https://github.com/vette-security/vette/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![npm version](https://img.shields.io/badge/npm-v0.1.0-red?style=flat-square&logo=npm)](https://www.npmjs.com/package/vette)
[![VS Code Extension](https://img.shields.io/badge/VS_Code-Extension_Ready-blue?style=flat-square&logo=visualstudiocode)](https://github.com/vette-security/vette/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

<br/>

```text
       ┌─────────────────────────────────────────────────────────────┐
       │   DEVELOPER PROMPTS LLM  ──►  COPIES "npm install slop-pkg"  │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   🛡️ VETTE INTERCEPTOR  │
                         └────────────┬────────────┘
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        [Score < 30 : TRUSTED]              [Score ≥ 70 : CRITICAL RISK]
        Transparent Pass-Through             🚨 HARD BLOCK (0ms script run)
         Runs native `npm install`            Host machine remains safe!
```

</div>

---

## ⚡ 1-Second Quick Install

### Windows (PowerShell)
Open PowerShell and run:
```powershell
irm https://raw.githubusercontent.com/vette-security/vette/main/install.ps1 | iex
```

### macOS / Linux (Bash / Zsh)
Open terminal and run:
```bash
curl -fsSL https://raw.githubusercontent.com/vette-security/vette/main/install.sh | bash
```

### Universal npm / npx
```bash
# Run instantly with npx (zero installation):
npx vette vet react

# Or install globally:
npm install -g vette
```

---

## 🛑 The Threat: AI "Slopsquatting"

When developers prompt LLMs (ChatGPT, Claude, Cursor, Copilot) for code, the model frequently **hallucinates plausible package names** that don't exist:
- `react-secure-crypto-utils`
- `langchain-gemini-tools`
- `fastapi-jwt-bearer-auth`

**The Zero-Day Attack:** Attackers continuously scrape public LLM outputs, register these exact hallucinated names on **npm** and **PyPI**, and pack malicious stealers into `postinstall` scripts or `setup.py`. When a developer copies the LLM snippet and runs `npm install`, the payload executes **immediately**.

### Why Existing Tools Fail

| Security Feature | `npm audit` | Snyk / Dependabot | Socket.dev | 🛡️ **Vette** |
| :--- | :---: | :---: | :---: | :---: |
| **Blocks BEFORE Lifecycle Scripts Run** | ❌ No | ❌ No | ❌ No | ✅ **YES (Pre-execution Gate)** |
| **Zero-Day / Freshness Protection (<72h)** | ❌ No | ❌ No | ⚠️ Partial | ✅ **YES (Real-time Velocity Engine)** |
| **Detects Unregistered AI Hallucinations** | ❌ No | ❌ No | ❌ No | ✅ **YES (Hallucination Alert)** |
| **Zero Setup / Drops into Shell Aliases** | ❌ No | ❌ No | ❌ No | ✅ **YES (`npm` / `pip` shims)** |
| **IDE Squigglies & Hover for VS Code/Cursor**| ❌ No | ❌ No | ❌ No | ✅ **YES (Native .vsix Extension)** |
| **Execution Latency Overhead** | High | High | Medium | ⚡ **< 15ms (Local Cache)** |

---

## 💻 IDE Extension (VS Code & Cursor)

Vette runs directly inside your IDE, giving you real-time visual feedback as you type or paste dependencies into `package.json` or `requirements.txt`.

<div align="center">
<img src="https://raw.githubusercontent.com/vette-security/vette/main/.github/assets/preview.png" alt="Vette IDE Preview" width="700" onerror="this.style.display='none'"/>
</div>

### Features:
- 🔴 **Inline Squigglies:** Marks hallucinated or dangerous packages in red before you ever run `npm install`.
- 🔍 **Rich Hover Card:** Hover over any package to inspect its **SlopScore (0–100)**, age, weekly download count, maintainers, and detected threat signals.
- 🛡️ **Status Bar Indicator:** `$(shield) Vette` in the bottom bar with 1-click workspace scan.

### Installation in VS Code or Cursor:
Download [`vette-vscode-0.1.0.vsix`](extension/vette-vscode-0.1.0.vsix) from [Releases](https://github.com/vette-security/vette/releases) and install via CLI:
```bash
# For VS Code:
code --install-extension extension/vette-vscode-0.1.0.vsix

# For Cursor:
cursor --install-extension extension/vette-vscode-0.1.0.vsix
```
*Or via GUI:* Open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`) ➔ `...` ➔ **Install from VSIX...**

---

## 🐙 GitHub Action (Pull Request CI/CD)

Block malicious slopsquats from ever entering your codebase during Pull Requests.

Create `.github/workflows/vette.yml`:
```yaml
name: Vette Security Guard

on:
  pull_request:
    paths:
      - 'package.json'
      - 'requirements.txt'

jobs:
  vet-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Vette Guard
        run: npx --yes vette action
```

### What It Injects Into Your PR:
- **Rich Markdown Step Summary:** Summarizes every modified dependency with SlopScore, age, and weekly volume.
- **Inline PR Annotations (`::error::` / `::warning::`):** Highlights dangerous lines directly in GitHub's file diff review UI.
- **Fail-Safe CI Gate:** Exits with `code 1` on critical risk, blocking PR merges automatically.

---

## 🖥️ CLI Usage Guide

### 1. Direct Package Vetting
```bash
# Vet an npm package
vette vet react
vette vet react-secure-crypto-utils

# Vet a PyPI package
vette vet requests -r pypi
vette vet langchain-gemini-tools-v2 -r pypi
```

### 2. Intercept Package Manager Installs
Wrap package managers so dangerous packages are halted before scripts touch disk:
```bash
# Intercepts and blocks if malicious:
vette npm install react-secure-crypto-utils

# Works for Python pip:
vette pip install langchain-gemini-tools-v2
```

### 3. Scan Entire Projects
```bash
# Scan Node.js project
vette scan package.json

# Scan Python project
vette scan requirements.txt
```

---

## 📊 The SlopScore Heuristics

Every package receives a **SlopScore (0–100)**:

| Heuristic | Signal | Penalty |
| :--- | :--- | :---: |
| **Extreme Freshness** | Created $< 24$ hours ago | **+35 pts** |
| **High Freshness** | Created $< 72$ hours ago | **+25 pts** |
| **Zero Downloads** | 0 downloads recorded in the past week | **+25 pts** |
| **Low Adoption** | $< 50$ weekly downloads | **+15 pts** |
| **Dangerous Lifecycle Scripts** | Contains `postinstall`/`preinstall` shell commands (`curl`, `cmd`, `sh`, `eval`) | **+25 to +40 pts** |
| **Lexical Slop Compound** | Matches brand + generic token pattern (`<brand>-utils`, `<brand>-helper`) | **+20 pts** |
| **Unregistered / Hallucination** | Package does not exist on public registry (404) | **+85 pts** |
| **High Community Trust** | $> 10,000$ weekly downloads & $> 180$ days history | **-25 pts (Bonus)** |

---

## ⚡ Microsecond Caching
Vette caches verified packages in `~/.vette/cache.json`:
- **Mature Safe Packages:** Cached for 7 days (sub-10ms instantaneous lookups).
- **Fresh / Risky Packages:** Short TTL to re-evaluate reputation in real-time.
- **Clear Cache:** `vette clear-cache`

---

## 🤝 Contributing

We welcome community contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

To report active AI-hallucinated packages found in the wild, please open a [Slopsquat Alert Issue](https://github.com/vette-security/vette/issues/new?template=report_slopsquat.yml).

---

## 📄 License

MIT License © 2026 [Vette Security](https://github.com/vette-security)
