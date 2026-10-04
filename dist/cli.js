#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import pc5 from "picocolors";

// src/ui/display.ts
import pc from "picocolors";
function printBanner() {
  console.log(
    pc.bold(pc.cyan("\u{1F6E1}\uFE0F  Vette")) + pc.dim(" v0.1.0 \u2014 Pre-install AI Slopsquatting & Zero-Day Interceptor")
  );
}
function renderScoreGauge(score) {
  const totalBars = 10;
  const filled = Math.round(score / 100 * totalBars);
  const empty = totalBars - filled;
  let colorFn = pc.green;
  if (score >= 70) colorFn = pc.red;
  else if (score >= 30) colorFn = pc.yellow;
  const bar = colorFn("\u2588".repeat(filled)) + pc.dim("\u2591".repeat(empty));
  return `[${bar}] ${colorFn(pc.bold(`${score}/100`))}`;
}
function displayVettingCard(result) {
  const { packageName, registry, slopScore, riskLevel, heuristics, metadata, cached } = result;
  console.log("\n" + "\u2500".repeat(64));
  let header = "";
  if (riskLevel === "DANGEROUS") {
    header = pc.bgRed(pc.white(pc.bold(" \u26A0\uFE0F  CRITICAL RISK DETECTED "))) + " " + pc.bold(pc.red(packageName));
  } else if (riskLevel === "SUSPICIOUS") {
    header = pc.bgYellow(pc.black(pc.bold(" \u26A0\uFE0F  SUSPICIOUS PACKAGE "))) + " " + pc.bold(pc.yellow(packageName));
  } else {
    header = pc.bgGreen(pc.black(pc.bold(" \u2713 VERIFIED SAFE "))) + " " + pc.bold(pc.green(packageName));
  }
  console.log(header + pc.dim(` (${registry})`));
  console.log(
    pc.dim("SlopScore: ") + renderScoreGauge(slopScore) + pc.dim(` [${riskLevel}]`) + (cached ? pc.dim(" (from cache)") : "")
  );
  if (metadata.latestVersion) {
    console.log(pc.dim("Version:   ") + pc.cyan(metadata.latestVersion));
  }
  const pubDate = metadata.latestPublishedAt || metadata.createdAt;
  if (pubDate) {
    const ageHours = Math.round((Date.now() - new Date(pubDate).getTime()) / (1e3 * 60 * 60));
    const ageDays = (ageHours / 24).toFixed(1);
    const ageColor = ageHours < 72 ? pc.red : pc.green;
    console.log(
      pc.dim("Published: ") + ageColor(`${pubDate} (~${ageHours}h / ${ageDays}d ago)`)
    );
  }
  if (registry === "npm") {
    const dlColor = metadata.downloadsLastWeek === 0 ? pc.red : pc.cyan;
    console.log(
      pc.dim("Downloads: ") + dlColor(`${metadata.downloadsLastWeek.toLocaleString()} last week`)
    );
  }
  if (metadata.author?.name) {
    console.log(pc.dim("Author:    ") + pc.white(metadata.author.name) + (metadata.author.email ? pc.dim(` <${metadata.author.email}>`) : ""));
  }
  if (metadata.hasInstallScripts) {
    console.log(
      pc.bold(pc.red("Hooks:     ")) + pc.red(pc.bold(Object.keys(metadata.installScripts).join(", ") + " (EXECUTES CODE ON HOST)"))
    );
  }
  if (heuristics.length > 0) {
    console.log("\n" + pc.bold("Security Signals & Heuristics:"));
    for (const h of heuristics) {
      let icon = pc.cyan("\u2139");
      let titleColor = pc.cyan;
      if (h.severity === "critical") {
        icon = pc.red("\u2716");
        titleColor = pc.red;
      } else if (h.severity === "high") {
        icon = pc.red("\u25B2");
        titleColor = pc.red;
      } else if (h.severity === "warning") {
        icon = pc.yellow("\u26A0");
        titleColor = pc.yellow;
      }
      const pts = h.points > 0 ? `+${h.points}` : `${h.points}`;
      console.log(`  ${icon} ${titleColor(pc.bold(h.title))} ${pc.dim(`[${pts} pts]`)}`);
      console.log(`     ${pc.dim(h.description)}`);
    }
  }
  console.log("\u2500".repeat(64) + "\n");
}

// src/registries/npm.ts
async function fetchNpmMetadata(packageName) {
  const cleanName = packageName.trim();
  const encodedName = cleanName.startsWith("@") ? `@${encodeURIComponent(cleanName.slice(1))}` : encodeURIComponent(cleanName);
  const registryUrl = `https://registry.npmjs.org/${encodedName}`;
  const downloadsUrl = `https://api.npmjs.org/downloads/point/last-week/${encodedName}`;
  try {
    const [metaRes, dlRes] = await Promise.allSettled([
      fetch(registryUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500)
      }),
      fetch(downloadsUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500)
      })
    ]);
    if (metaRes.status === "rejected" || !metaRes.value.ok) {
      if (metaRes.status === "fulfilled" && metaRes.value.status === 404) {
        return {
          name: cleanName,
          registry: "npm",
          downloadsLastWeek: 0,
          maintainers: [],
          hasInstallScripts: false,
          installScripts: {},
          isNotFound: true
        };
      }
      return {
        name: cleanName,
        registry: "npm",
        downloadsLastWeek: 0,
        maintainers: [],
        hasInstallScripts: false,
        installScripts: {},
        isNotFound: false,
        error: metaRes.status === "rejected" ? metaRes.reason?.message : `HTTP ${metaRes.value.status}`
      };
    }
    const data = await metaRes.value.json();
    let downloadsLastWeek = 0;
    if (dlRes.status === "fulfilled" && dlRes.value.ok) {
      try {
        const dlData = await dlRes.value.json();
        downloadsLastWeek = Number(dlData.downloads) || 0;
      } catch {
        downloadsLastWeek = 0;
      }
    }
    const latestTag = data["dist-tags"]?.latest;
    const latestVersion = latestTag || Object.keys(data.versions || {}).pop();
    const versionObj = latestVersion ? data.versions?.[latestVersion] : null;
    const scripts = versionObj?.scripts || {};
    const dangerousKeys = ["preinstall", "install", "postinstall", "preuninstall", "postuninstall"];
    const installScripts = {};
    for (const key of dangerousKeys) {
      if (scripts[key]) {
        installScripts[key] = String(scripts[key]);
      }
    }
    const maintainers = Array.isArray(data.maintainers) ? data.maintainers.map((m) => m.name || m.email || JSON.stringify(m)) : [];
    return {
      name: cleanName,
      registry: "npm",
      latestVersion,
      createdAt: data.time?.created,
      latestPublishedAt: latestVersion && data.time?.[latestVersion] ? data.time[latestVersion] : data.time?.modified,
      author: data.author ? { name: data.author.name, email: data.author.email } : void 0,
      maintainers,
      downloadsLastWeek,
      hasInstallScripts: Object.keys(installScripts).length > 0,
      installScripts,
      isNotFound: false
    };
  } catch (err) {
    return {
      name: cleanName,
      registry: "npm",
      downloadsLastWeek: 0,
      maintainers: [],
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false,
      error: err?.message || "Network error fetching npm metadata"
    };
  }
}

// src/registries/pypi.ts
async function fetchPypiMetadata(packageName) {
  const cleanName = packageName.trim().toLowerCase();
  const url = `https://pypi.org/pypi/${encodeURIComponent(cleanName)}/json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) {
      if (res.status === 404) {
        return {
          name: cleanName,
          registry: "pypi",
          downloadsLastWeek: 0,
          maintainers: [],
          hasInstallScripts: false,
          installScripts: {},
          isNotFound: true
        };
      }
      return {
        name: cleanName,
        registry: "pypi",
        downloadsLastWeek: 0,
        maintainers: [],
        hasInstallScripts: false,
        installScripts: {},
        isNotFound: false,
        error: `PyPI HTTP ${res.status}`
      };
    }
    const data = await res.json();
    const info = data.info || {};
    const latestVersion = info.version;
    const releaseFiles = data.releases && latestVersion && data.releases[latestVersion] || [];
    let latestPublishedAt;
    if (releaseFiles.length > 0 && releaseFiles[0].upload_time_iso_8601) {
      latestPublishedAt = releaseFiles[0].upload_time_iso_8601;
    }
    let createdAt = latestPublishedAt;
    if (data.releases) {
      const allUploadDates = [];
      for (const ver of Object.keys(data.releases)) {
        for (const file of data.releases[ver] || []) {
          if (file.upload_time_iso_8601) {
            allUploadDates.push(file.upload_time_iso_8601);
          }
        }
      }
      if (allUploadDates.length > 0) {
        allUploadDates.sort();
        createdAt = allUploadDates[0];
      }
    }
    const maintainers = [];
    if (info.author) maintainers.push(info.author);
    if (info.maintainer) maintainers.push(info.maintainer);
    return {
      name: cleanName,
      registry: "pypi",
      latestVersion,
      createdAt,
      latestPublishedAt,
      author: {
        name: info.author || info.maintainer,
        email: info.author_email || info.maintainer_email
      },
      maintainers,
      downloadsLastWeek: 0,
      // PyPI removed download counts from its JSON API; handled in heuristics
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false
    };
  } catch (err) {
    return {
      name: cleanName,
      registry: "pypi",
      downloadsLastWeek: 0,
      maintainers: [],
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false,
      error: err?.message || "Network error fetching PyPI metadata"
    };
  }
}

// src/engine/heuristics.ts
var FAMOUS_ROOTS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "next",
  "nuxt",
  "express",
  "fastify",
  "koa",
  "nestjs",
  "trpc",
  "langchain",
  "openai",
  "anthropic",
  "gemini",
  "transformers",
  "aws",
  "azure",
  "gcp",
  "supabase",
  "firebase",
  "prisma",
  "tailwind",
  "stripe",
  "auth0",
  "jwt",
  "boto3",
  "fastapi",
  "django",
  "flask",
  "pydantic",
  "pandas",
  "numpy",
  "scikit"
];
var HALLUCINATION_TOKENS = [
  "utils",
  "util",
  "helper",
  "helpers",
  "tools",
  "tool",
  "wrapper",
  "connector",
  "bridge",
  "crypto",
  "secure",
  "security",
  "client",
  "bearer",
  "validator",
  "kit",
  "manager",
  "sdk",
  "core-utils",
  "auth-bearer",
  "provider"
];
var DANGEROUS_COMMAND_PATTERNS = [
  /curl\s+/i,
  /wget\s+/i,
  /powershell/i,
  /cmd\.exe/i,
  /sh\s+-c/i,
  /bash\s+/i,
  /node\s+-e/i,
  /base64/i,
  /eval\(/i,
  /exec\(/i,
  /spawn\(/i,
  /socket/i,
  /fetch\(/i,
  /http/i,
  /discordapp\.com\/api\/webhooks/i,
  /telegram\.org\/bot/i
];
function evaluatePackageHeuristics(metadata) {
  const evaluations = [];
  if (metadata.isNotFound) {
    evaluations.push({
      id: "NOT_FOUND",
      category: "lexical",
      points: 85,
      severity: "critical",
      title: "Unregistered / Hallucinated Package",
      description: `Package '${metadata.name}' does not exist on ${metadata.registry}. Attackers often monitor and register such names after LLMs hallucinate them!`
    });
    return evaluations;
  }
  const now = Date.now();
  const pubTime = metadata.latestPublishedAt || metadata.createdAt;
  const ageMs = pubTime ? now - new Date(pubTime).getTime() : null;
  const ageHours = ageMs !== null ? ageMs / (1e3 * 60 * 60) : null;
  const ageDays = ageHours !== null ? ageHours / 24 : null;
  if (ageHours !== null && ageHours < 24) {
    evaluations.push({
      id: "EXTREME_FRESHNESS",
      category: "age",
      points: 35,
      severity: "critical",
      title: "Extremely Fresh Package (<24h)",
      description: `Published only ${Math.round(ageHours)} hours ago. High correlation with zero-day slopsquatting.`
    });
  } else if (ageHours !== null && ageHours < 72) {
    evaluations.push({
      id: "HIGH_FRESHNESS",
      category: "age",
      points: 25,
      severity: "high",
      title: "Fresh Package (<72h)",
      description: `Published ${Math.round(ageHours)} hours ago (${Math.round(ageDays)} days ago). CVE databases will not have caught malicious activity yet.`
    });
  } else if (ageDays !== null && ageDays < 7) {
    evaluations.push({
      id: "RECENT_PUBLISH",
      category: "age",
      points: 15,
      severity: "warning",
      title: "Recently Published (<7 days)",
      description: `Published ${Math.round(ageDays)} days ago. Still within zero-day incubation period.`
    });
  } else if (ageDays !== null && ageDays > 180) {
    evaluations.push({
      id: "MATURE_PACKAGE",
      category: "age",
      points: -15,
      severity: "info",
      title: "Mature Package History",
      description: `First created over ${Math.round(ageDays)} days ago. Established ecosystem presence.`
    });
  }
  if (metadata.registry === "npm") {
    if (metadata.downloadsLastWeek === 0) {
      evaluations.push({
        id: "ZERO_DOWNLOADS",
        category: "downloads",
        points: 25,
        severity: "high",
        title: "Zero Weekly Downloads",
        description: "No community adoption or real-world verification found."
      });
    } else if (metadata.downloadsLastWeek < 50) {
      evaluations.push({
        id: "MINIMAL_DOWNLOADS",
        category: "downloads",
        points: 15,
        severity: "warning",
        title: "Very Low Downloads (<50/week)",
        description: `Only ${metadata.downloadsLastWeek} downloads recorded in the past week.`
      });
    } else if (metadata.downloadsLastWeek > 1e4) {
      evaluations.push({
        id: "HIGH_COMMUNITY_TRUST",
        category: "downloads",
        points: -25,
        severity: "info",
        title: "Strong Community Adoption",
        description: `${metadata.downloadsLastWeek.toLocaleString()} weekly downloads. Broad community testing reduces slopsquat risk.`
      });
    }
  }
  if (metadata.hasInstallScripts) {
    let scriptSeverity = "high";
    let scriptPoints = 25;
    const dangerousCommandsFound = [];
    for (const [scriptName, scriptContent] of Object.entries(metadata.installScripts)) {
      for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(scriptContent)) {
          dangerousCommandsFound.push(`${scriptName}: ${scriptContent.slice(0, 60)}...`);
          scriptSeverity = "critical";
          scriptPoints = 40;
          break;
        }
      }
    }
    evaluations.push({
      id: "LIFECYCLE_SCRIPTS_DETECTED",
      category: "scripts",
      points: scriptPoints,
      severity: scriptSeverity,
      title: dangerousCommandsFound.length > 0 ? "Dangerous Post-Install Commands Detected!" : "Lifecycle Scripts Present (pre/postinstall)",
      description: dangerousCommandsFound.length > 0 ? `Found shell execution / network commands: ${dangerousCommandsFound.join("; ")}` : `Package contains install hooks (${Object.keys(metadata.installScripts).join(", ")}). These run automatically upon install.`
    });
  }
  if (metadata.maintainers.length <= 1) {
    evaluations.push({
      id: "SINGLE_MAINTAINER",
      category: "publisher",
      points: 10,
      severity: "info",
      title: "Single Maintainer",
      description: "Single author control with no organization or team oversight."
    });
  }
  const normalizedName = metadata.name.toLowerCase().replace(/[@/]/g, "-");
  const matchedRoot = FAMOUS_ROOTS.find((root) => normalizedName.includes(root));
  const matchedToken = HALLUCINATION_TOKENS.find((token) => normalizedName.includes(token));
  if (matchedRoot && matchedToken && !metadata.name.startsWith("@")) {
    evaluations.push({
      id: "AI_SLOP_LEXICAL_MATCH",
      category: "lexical",
      points: 20,
      severity: "high",
      title: "Matches AI Hallucination Pattern",
      description: `Combines brand root '${matchedRoot}' with generic token '${matchedToken}' without official scope. Common in LLM slopsquats.`
    });
  }
  return evaluations;
}

// src/engine/scorer.ts
function calculateSlopScore(metadata) {
  const heuristics = evaluatePackageHeuristics(metadata);
  let rawScore = 0;
  for (const h of heuristics) {
    rawScore += h.points;
  }
  const slopScore = Math.min(100, Math.max(0, rawScore));
  let riskLevel = "SAFE";
  if (slopScore >= 70) {
    riskLevel = "DANGEROUS";
  } else if (slopScore >= 30) {
    riskLevel = "SUSPICIOUS";
  }
  return {
    packageName: metadata.name,
    registry: metadata.registry,
    slopScore,
    riskLevel,
    heuristics,
    metadata,
    cached: false,
    timestamp: Date.now()
  };
}

// src/cache/cache.ts
import fs from "fs";
import path from "path";
import os from "os";
var VetteCache = class {
  cacheDir;
  cacheFile;
  memoryCache = /* @__PURE__ */ new Map();
  isLoaded = false;
  constructor() {
    this.cacheDir = path.join(os.homedir(), ".vette");
    this.cacheFile = path.join(this.cacheDir, "cache.json");
  }
  ensureDir() {
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {
      }
    }
  }
  load() {
    if (this.isLoaded) return;
    this.isLoaded = true;
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, "utf-8");
        const data = JSON.parse(raw);
        const now = Date.now();
        for (const [key, entry] of Object.entries(data)) {
          if (entry.expiresAt > now) {
            this.memoryCache.set(key, entry);
          }
        }
      }
    } catch {
      this.memoryCache.clear();
    }
  }
  save() {
    this.ensureDir();
    try {
      const obj = {};
      const now = Date.now();
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.expiresAt > now) {
          obj[k] = v;
        }
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch {
    }
  }
  get(registry, packageName) {
    this.load();
    const key = `${registry}:${packageName.toLowerCase()}`;
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return { ...entry.result, cached: true };
  }
  set(result) {
    this.load();
    const key = `${result.registry}:${result.packageName.toLowerCase()}`;
    let ttlMs = 1e3 * 60 * 60 * 24 * 7;
    if (result.riskLevel === "DANGEROUS" || result.riskLevel === "SUSPICIOUS") {
      ttlMs = 1e3 * 60 * 30;
    } else if (result.slopScore > 10) {
      ttlMs = 1e3 * 60 * 60 * 6;
    }
    this.memoryCache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs
    });
    this.save();
  }
  clear() {
    this.memoryCache.clear();
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch {
    }
  }
};
var vetteCache = new VetteCache();

// src/engine/service.ts
async function vetPackage(packageName, registry = "npm", options = {}) {
  if (!options.bypassCache) {
    const cached = vetteCache.get(registry, packageName);
    if (cached) {
      return cached;
    }
  }
  const metadata = registry === "pypi" ? await fetchPypiMetadata(packageName) : await fetchNpmMetadata(packageName);
  const result = calculateSlopScore(metadata);
  vetteCache.set(result);
  return result;
}

// src/commands/scan.ts
import fs2 from "fs";
import path2 from "path";
import pc2 from "picocolors";
async function runScan(targetPath) {
  const file = targetPath || "package.json";
  const fullPath = path2.resolve(process.cwd(), file);
  if (!fs2.existsSync(fullPath)) {
    console.error(pc2.red(`Target file not found: ${fullPath}`));
    return 1;
  }
  console.log(pc2.cyan(`
\u{1F50D} Vette scanning: ${pc2.bold(file)}...`));
  const isPython = file.endsWith(".txt") || file.includes("requirements");
  const packagesToScan = [];
  if (isPython) {
    const content = fs2.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([a-zA-Z0-9_\-.]+)/);
      if (match) {
        packagesToScan.push({ name: match[1], registry: "pypi" });
      }
    }
  } else {
    try {
      const raw = fs2.readFileSync(fullPath, "utf-8");
      const pkgJson = JSON.parse(raw);
      const allDeps = {
        ...pkgJson.dependencies || {},
        ...pkgJson.devDependencies || {}
      };
      for (const name of Object.keys(allDeps)) {
        packagesToScan.push({ name, registry: "npm" });
      }
    } catch (err) {
      console.error(pc2.red(`Failed to parse ${file}: ${err.message}`));
      return 1;
    }
  }
  if (packagesToScan.length === 0) {
    console.log(pc2.yellow("No dependencies found to scan."));
    return 0;
  }
  console.log(pc2.dim(`Found ${packagesToScan.length} dependencies. Checking real-time registry reputation...
`));
  const results = [];
  const start = Date.now();
  const chunkSize = 10;
  for (let i = 0; i < packagesToScan.length; i += chunkSize) {
    const chunk = packagesToScan.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((pkg) => vetPackage(pkg.name, pkg.registry))
    );
    results.push(...chunkResults);
  }
  const duration = Date.now() - start;
  let dangerousCount = 0;
  let suspiciousCount = 0;
  for (const r of results) {
    if (r.riskLevel === "DANGEROUS") {
      dangerousCount++;
      displayVettingCard(r);
    } else if (r.riskLevel === "SUSPICIOUS") {
      suspiciousCount++;
      displayVettingCard(r);
    }
  }
  console.log("\u2550".repeat(64));
  console.log(
    pc2.bold("Scan Complete in ") + pc2.cyan(`${duration}ms`) + pc2.dim(` (${results.length} packages scanned)`)
  );
  console.log(
    `Status: ` + (dangerousCount > 0 ? pc2.red(pc2.bold(`${dangerousCount} Dangerous`)) : pc2.green("0 Dangerous")) + " | " + (suspiciousCount > 0 ? pc2.yellow(pc2.bold(`${suspiciousCount} Suspicious`)) : pc2.green("0 Suspicious")) + " | " + pc2.green(`${results.length - dangerousCount - suspiciousCount} Safe`)
  );
  console.log("\u2550".repeat(64) + "\n");
  if (dangerousCount > 0) {
    console.log(pc2.red(pc2.bold("\u2716 Scan failed: High-risk slopsquatting or dangerous hooks detected.")));
    return 1;
  }
  console.log(pc2.green(pc2.bold("\u2713 All dependencies passed Vette security verification.")));
  return 0;
}

// src/commands/github-action.ts
import fs3 from "fs";
import path3 from "path";
import pc3 from "picocolors";
async function runGithubAction() {
  console.log(pc3.bold(pc3.cyan("\u{1F6E1}\uFE0F  Vette GitHub Action: Scanning Pull Request / Commit Dependencies...")));
  const candidates = [
    { file: "package.json", registry: "npm" },
    { file: "requirements.txt", registry: "pypi" }
  ];
  const packagesToCheck = [];
  for (const candidate of candidates) {
    const fullPath = path3.resolve(process.cwd(), candidate.file);
    if (!fs3.existsSync(fullPath)) continue;
    if (candidate.registry === "npm") {
      try {
        const raw = fs3.readFileSync(fullPath, "utf-8");
        const json = JSON.parse(raw);
        const allDeps = {
          ...json.dependencies || {},
          ...json.devDependencies || {}
        };
        for (const [name, ver] of Object.entries(allDeps)) {
          packagesToCheck.push({
            name,
            version: String(ver),
            registry: "npm",
            sourceFile: candidate.file
          });
        }
      } catch (err) {
        console.warn(`Failed to parse ${candidate.file}: ${err.message}`);
      }
    } else {
      const content = fs3.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_\-.]+)(?:([=<>!~]+)(.*))?$/);
        if (match) {
          packagesToCheck.push({
            name: match[1],
            version: match[3],
            registry: "pypi",
            sourceFile: candidate.file
          });
        }
      }
    }
  }
  if (packagesToCheck.length === 0) {
    console.log(pc3.green("\u2713 No manifest dependencies found to audit."));
    return 0;
  }
  console.log(pc3.dim(`Auditing ${packagesToCheck.length} dependencies against AI slopsquatting heuristics...
`));
  const results = [];
  for (const pkg of packagesToCheck) {
    const res = await vetPackage(pkg.name, pkg.registry);
    results.push({ item: pkg, result: res });
  }
  let dangerousCount = 0;
  let suspiciousCount = 0;
  let markdownSummary = "## \u{1F6E1}\uFE0F Vette AI Slopsquatting & Zero-Day Security Report\n\n";
  markdownSummary += "> Vet packages before they run. Pre-install protection against AI hallucinated package poisoning.\n\n";
  markdownSummary += "| Package | Registry | SlopScore | Risk Level | Age | Downloads | Signals |\n";
  markdownSummary += "| :--- | :--- | :---: | :---: | :--- | :--- | :--- |\n";
  for (const { item, result } of results) {
    const { slopScore, riskLevel, metadata, heuristics } = result;
    let badge = "\u{1F7E2} Safe";
    if (riskLevel === "DANGEROUS") {
      badge = "\u{1F534} **DANGEROUS**";
      dangerousCount++;
      console.log(`::error file=${item.sourceFile},title=Vette Critical Slopsquat Alert::Package "${item.name}" flagged as DANGEROUS (SlopScore: ${slopScore}/100). Zero-day slopsquatting or malicious postinstall detected!`);
    } else if (riskLevel === "SUSPICIOUS") {
      badge = "\u{1F7E1} **Suspicious**";
      suspiciousCount++;
      console.log(`::warning file=${item.sourceFile},title=Vette Suspicious Package::Package "${item.name}" flagged as Suspicious (SlopScore: ${slopScore}/100). High freshness or low download volume.`);
    }
    const pubDate = metadata.latestPublishedAt || metadata.createdAt;
    const ageStr = pubDate ? `~${Math.round((Date.now() - new Date(pubDate).getTime()) / (1e3 * 60 * 60 * 24))}d ago` : "Unknown";
    const dlStr = item.registry === "npm" ? `${metadata.downloadsLastWeek.toLocaleString()}/wk` : "N/A";
    const signalsList = heuristics.map((h) => h.title).slice(0, 2).join("; ") || "None";
    markdownSummary += `| \`${item.name}\` | \`${item.registry}\` | **${slopScore}/100** | ${badge} | ${ageStr} | ${dlStr} | ${signalsList} |
`;
  }
  markdownSummary += "\n### Executive Summary\n";
  markdownSummary += `- **Total Checked:** ${results.length}
`;
  markdownSummary += `- **Critical / Dangerous:** ${dangerousCount}
`;
  markdownSummary += `- **Suspicious:** ${suspiciousCount}
`;
  markdownSummary += `- **Safe:** ${results.length - dangerousCount - suspiciousCount}

`;
  if (dangerousCount > 0) {
    markdownSummary += "> \u274C **Action Required:** One or more packages were flagged with critical risk. Pull request build failed to prevent supply chain poisoning.\n";
  } else if (suspiciousCount > 0) {
    markdownSummary += "> \u26A0\uFE0F **Notice:** Suspicious packages detected with low traction or recent publication dates. Please review carefully.\n";
  } else {
    markdownSummary += "> \u2705 **All dependencies verified safe.** No AI hallucinated slopsquats or zero-day poisoning traits detected.\n";
  }
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      fs3.appendFileSync(summaryFile, markdownSummary);
      console.log(pc3.green("\u2713 GitHub Step Summary updated successfully."));
    } catch (err) {
      console.warn(`Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }
  console.log("\n" + markdownSummary);
  if (dangerousCount > 0) {
    console.log(pc3.red(pc3.bold(`
\u2716 Vette failed with ${dangerousCount} dangerous package(s). Build aborted.`)));
    return 1;
  }
  console.log(pc3.green(pc3.bold("\n\u2713 Vette audit passed. No malicious slopsquats detected.")));
  return 0;
}

// src/commands/intercept.ts
import readline from "readline";
import pc4 from "picocolors";

// src/interceptor/parser.ts
function parseInterceptedCommand(args) {
  if (args.length === 0) return null;
  const rawArgs2 = [...args];
  const first = rawArgs2[0].toLowerCase();
  let manager;
  let restArgs;
  if (["npm", "pnpm", "yarn", "bun", "pip", "uv"].includes(first)) {
    manager = first;
    restArgs = rawArgs2.slice(1);
  } else if (["install", "add", "i"].includes(first)) {
    manager = "npm";
    restArgs = rawArgs2;
  } else {
    return null;
  }
  const isPython = manager === "pip" || manager === "uv";
  const defaultRegistry = isPython ? "pypi" : "npm";
  const installVerbs = isPython ? ["install"] : ["install", "i", "add"];
  const hasInstallVerb = restArgs.some((arg) => installVerbs.includes(arg.toLowerCase()));
  const packages = [];
  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (installVerbs.includes(arg.toLowerCase())) continue;
    if (arg.startsWith("-")) {
      if ((arg === "-r" || arg === "--requirement" || arg === "-f") && i + 1 < restArgs.length) {
        i++;
      }
      continue;
    }
    if (isPython) {
      const match = arg.match(/^([a-zA-Z0-9_\-.]+)(?:([=<>!~]+)(.*))?$/);
      if (match) {
        packages.push({
          name: match[1],
          version: match[3],
          registry: "pypi"
        });
      }
    } else {
      let name = arg;
      let version;
      if (arg.startsWith("@")) {
        const parts = arg.slice(1).split("@");
        name = `@${parts[0]}`;
        if (parts.length > 1) version = parts[1];
      } else {
        const parts = arg.split("@");
        name = parts[0];
        if (parts.length > 1) version = parts[1];
      }
      if (name && !name.startsWith(".") && !name.startsWith("/")) {
        packages.push({
          name,
          version,
          registry: "npm"
        });
      }
    }
  }
  return {
    manager,
    action: hasInstallVerb ? "install" : "other",
    packages,
    rawArgs: rawArgs2
  };
}

// src/interceptor/runner.ts
import { spawn } from "child_process";
function runPassthroughCommand(manager, args) {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" && manager === "npm" ? "npm.cmd" : manager;
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("close", (code) => {
      resolve(code ?? 0);
    });
    child.on("error", (err) => {
      console.error(`Failed to execute ${manager}:`, err.message);
      resolve(1);
    });
  });
}

// src/commands/intercept.ts
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}
async function handleIntercept(rawArgs2, forceUnsafe = false) {
  const parsed = parseInterceptedCommand(rawArgs2);
  if (!parsed || parsed.action !== "install" || parsed.packages.length === 0) {
    const manager2 = parsed?.manager || rawArgs2[0] || "npm";
    const rest2 = parsed ? rawArgs2.slice(1) : rawArgs2.slice(1);
    return runPassthroughCommand(manager2, rest2);
  }
  console.log(pc4.cyan(`\u{1F6E1}\uFE0F  Vette inspecting ${parsed.packages.length} package(s) before execution...`));
  const results = [];
  for (const pkg of parsed.packages) {
    const res = await vetPackage(pkg.name, pkg.registry);
    results.push(res);
  }
  let hasDangerous = false;
  let hasSuspicious = false;
  for (const res of results) {
    if (res.riskLevel === "DANGEROUS") {
      hasDangerous = true;
      displayVettingCard(res);
    } else if (res.riskLevel === "SUSPICIOUS") {
      hasSuspicious = true;
      displayVettingCard(res);
    }
  }
  if (hasDangerous) {
    if (forceUnsafe) {
      console.log(pc4.yellow("\n\u26A0\uFE0F  Bypassing critical security block due to --force-unsafe flag!"));
    } else {
      console.log(
        pc4.bgRed(pc4.white(pc4.bold(" \u{1F6A8} EXECUTION BLOCKED BY VETTE \u{1F6A8} "))) + "\n" + pc4.red(pc4.bold("High risk of AI Slopsquatting / Zero-Day poisoning detected!")) + "\n" + pc4.dim("Pre-install lifecycle scripts were prevented from running on your machine.") + "\n" + pc4.dim("If you are certain this package is legitimate, rerun with: ") + pc4.cyan(`vette --force-unsafe ${rawArgs2.join(" ")}
`)
      );
      return 1;
    }
  }
  if (hasSuspicious && !hasDangerous && !forceUnsafe) {
    const proceed = await askConfirmation(
      pc4.bold(pc4.yellow("\u26A0\uFE0F  Package flagged as suspicious. Do you wish to continue with installation? [y/N]: "))
    );
    if (!proceed) {
      console.log(pc4.red("\n\u2716 Installation aborted safely. Host was not modified.\n"));
      return 0;
    }
  }
  const [manager, ...rest] = rawArgs2;
  return runPassthroughCommand(manager, rest);
}

// src/cli.ts
var program = new Command();
program.name("vette").description("\u{1F6E1}\uFE0F  Zero-latency pre-install runtime interceptor and AI slopsquatting defense").version("0.1.0").option("--force-unsafe", "Bypass high-risk security blocks").allowUnknownOption(true);
program.command("vet <package>").description("Inspect a specific package reputation before installing").option("-r, --registry <registry>", "Registry to inspect (npm or pypi)", "npm").option("--no-cache", "Bypass local reputation cache").action(async (packageName, options) => {
  printBanner();
  const registry = options.registry.toLowerCase() === "pypi" ? "pypi" : "npm";
  console.log(pc5.cyan(`Vetting ${pc5.bold(packageName)} on ${registry}...`));
  const result = await vetPackage(packageName, registry, {
    bypassCache: options.cache === false
  });
  displayVettingCard(result);
  process.exit(result.riskLevel === "DANGEROUS" ? 1 : 0);
});
program.command("scan [target]").description("Scan package.json or requirements.txt for hallucinated / zero-day dependencies").action(async (target) => {
  printBanner();
  const code = await runScan(target);
  process.exit(code);
});
program.command("action").alias("github-action").description("Run Vette security check in GitHub Actions and output Step Summary & PR annotations").action(async () => {
  printBanner();
  const code = await runGithubAction();
  process.exit(code);
});
program.command("clear-cache").description("Purge the local Vette reputation cache").action(() => {
  vetteCache.clear();
  console.log(pc5.green("\u2713 Vette local reputation cache cleared."));
  process.exit(0);
});
program.command("init").description("Print shell configuration alias/shim to intercept npm/pip automatically").option("--shell <type>", "Shell type: zsh, bash, or powershell", "powershell").action((options) => {
  printBanner();
  console.log(pc5.bold("\nTo enable automatic pre-install interception in your shell:\n"));
  if (options.shell === "powershell" || process.platform === "win32") {
    console.log(pc5.cyan("# Add to your PowerShell $PROFILE:"));
    console.log(pc5.white(`function npm { vette npm $args }
function pip { vette pip $args }`));
  } else {
    console.log(pc5.cyan("# Add to ~/.bashrc or ~/.zshrc:"));
    console.log(pc5.white(`npm() { vette npm "$@"; }
pip() { vette pip "$@"; }`));
  }
  console.log(pc5.dim("\nOnce added, all `npm install` and `pip install` commands will be vetted before execution!"));
  process.exit(0);
});
var rawArgs = process.argv.slice(2);
var knownSubcommands = ["vet", "scan", "action", "github-action", "clear-cache", "init", "--help", "-h", "--version", "-V"];
if (rawArgs.length > 0 && !knownSubcommands.includes(rawArgs[0]) && !rawArgs[0].startsWith("-")) {
  const forceUnsafe = process.argv.includes("--force-unsafe");
  const filteredArgs = rawArgs.filter((a) => a !== "--force-unsafe");
  handleIntercept(filteredArgs, forceUnsafe).then((code) => process.exit(code)).catch((err) => {
    console.error(pc5.red("Vette interception error:"), err);
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
