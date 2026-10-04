<div align="center">

# 🛡️ Vette

### Don't just audit known CVEs. Vet packages before they run.

**The zero-latency runtime interceptor defending developers against AI "Slopsquatting", hallucinated package poisoning, and zero-day supply chain attacks.**

[![CI Matrix](https://img.shields.io/badge/CI-Passing-success?style=flat-square&logo=githubactions)](https://github.com/Kaustubh-Barad-007/vette/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![npm version](https://img.shields.io/badge/npm-v0.1.0-red?style=flat-square&logo=npm)](https://www.npmjs.com/package/vette)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

<br/>

```text
──────────────────────────────────────────────────────────────
 ✖ BLOCKED  react-secure-crypto-utils (npm)
  Threat Score: █████████░ 85/100 (CRITICAL RISK)
  Downloads:    0 last week

  Detected Signals:
    ✖ Unregistered / Hallucinated Package [+85 pts]
      Package does not exist on npm. Attackers frequently register
      these names after LLMs hallucinate them!

  ACTION  Installation prevented. Lifecycle scripts blocked from running.
──────────────────────────────────────────────────────────────
```

</div>

---

## ⚡ 1-Second Universal Installation

### 💻 1. Universal IDE Extension (VS Code, Cursor, Windsurf, VSCodium)
Installs and activates Vette into **all detected editors on your machine** with a single command:

- **Windows (PowerShell):**
  ```powershell
  irm https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install-extension.ps1 | iex
  ```
- **macOS / Linux (Terminal):**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install-extension.sh | bash
  ```
- **Via Vette CLI (if already installed):**
  ```bash
  vette install-extension
  ```

---

### 🛡️ 2. Terminal Pre-Install Guard (Auto-intercepts `npm` & `pip`)
Automatically wraps `npm install` and `pip install` in your shell so slopsquats are halted **before** scripts execute:

- **Windows (PowerShell):**
  ```powershell
  irm https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install.ps1 | iex
  ```
- **macOS / Linux:**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install.sh | bash
  ```
- **Universal CLI via npm:**
  ```bash
  npm install -g vette
  # Or run instantly without installing:
  npx vette vet react
  ```

---

## 🛑 The Threat: AI "Slopsquatting"

When developers prompt LLMs (ChatGPT, Claude, Cursor, Copilot) for code, the model frequently **hallucinates package names** that sound real:
- `react-secure-crypto-utils`
- `langchain-gemini-tools`
- `fastapi-jwt-bearer-auth`

**The Attack:** Scrapers harvest these hallucinated names from LLM logs and register them on **npm** and **PyPI** with malicious `postinstall` or `setup.py` hooks. When developers copy the code and run `npm install`, the payload runs **immediately**.

### Why Traditional Scanners Fail:
- **`npm audit` / Snyk / Dependabot:** Rely on *reported CVE databases*. A zero-day package published 10 minutes ago has **0 CVEs** and passes with zero warnings.
- **Execution Timing:** Audits run *after* installation. By then, the malicious `postinstall` hook has already exfiltrated `.env` secrets and SSH keys.
- **Vette's Pre-Install Gate:** Vette inspects package reputation in **<100ms** and **blocks execution before any script touches your system**.

---

## 🖥️ What Vette Looks Like in Action

### 1. Direct Inspection (Vetting)
```bash
# Check an npm package:
vette vet react
vette vet react-secure-crypto-utils

# Check a Python package on PyPI:
vette vet requests -r pypi
vette vet fastapi-jwt-auth-bearer -r pypi
```

### 2. Pre-Install Interception
```bash
# This detects the slopsquat and STOPS execution before npm runs!
vette npm install react-secure-crypto-utils

# Safe packages pass straight through with zero lag:
vette npm install picocolors
```

### 3. Full Project Dependency Audit
```bash
vette scan package.json
vette scan requirements.txt
```

---

## 💻 IDE Features (VS Code & Cursor)

- 🔴 **Red Squiggly Underlines:** Flags hallucinated or suspicious packages directly in `package.json` and `requirements.txt`.
- 🔍 **Rich Hover Cards:** Hover over any package to inspect its **SlopScore (0–100)**, age, weekly download count, and detected signals.
- 🛡️ **Status Bar Indicator:** `$(shield) Vette` in the bottom bar with 1-click workspace scan.

---

## 🐙 GitHub Action (Pull Request CI/CD)

Add `.github/workflows/vette.yml` to your repo to prevent malicious slopsquats from ever being merged into your codebase:

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
        run: node dist/cli.cjs action
```

- Injects rich **GitHub Step Summary** markdown tables into your PR.
- Places inline **PR Annotations** (`::error::` / `::warning::`) directly on the diff.
- Fails the build (`exit 1`) if a dangerous slopsquat is found.

---

## ⚡ Performance

- **Cache Hit Latency:** **< 2 milliseconds**
- **Uncached Registry Lookup:** **< 100 milliseconds**
- **Bundle Size:** Standalone **163 KB** single-file binary with zero external dependencies.

---

## 📄 License

MIT License © 2026 [Vette Security](https://github.com/Kaustubh-Barad-007/vette)
