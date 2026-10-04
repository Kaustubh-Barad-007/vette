import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { VettingResult } from '../types.js';

interface CacheEntry {
  result: VettingResult;
  expiresAt: number;
}

export class VetteCache {
  private cacheDir: string;
  private cacheFile: string;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isLoaded = false;

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.vette');
    this.cacheFile = path.join(this.cacheDir, 'cache.json');
  }

  private ensureDir() {
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {
        // Silently ignore if cannot create
      }
    }
  }

  private load() {
    if (this.isLoaded) return;
    this.isLoaded = true;
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf-8');
        const data = JSON.parse(raw) as Record<string, CacheEntry>;
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

  private save() {
    this.ensureDir();
    try {
      const obj: Record<string, CacheEntry> = {};
      const now = Date.now();
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.expiresAt > now) {
          obj[k] = v;
        }
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  get(registry: string, packageName: string): VettingResult | null {
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

  set(result: VettingResult): void {
    this.load();
    const key = `${result.registry}:${result.packageName.toLowerCase()}`;
    
    // Determine TTL based on risk and age
    let ttlMs = 1000 * 60 * 60 * 24 * 7; // Default 7 days for safe
    if (result.riskLevel === 'DANGEROUS' || result.riskLevel === 'SUSPICIOUS') {
      ttlMs = 1000 * 60 * 30; // 30 minutes for risky/fresh
    } else if (result.slopScore > 10) {
      ttlMs = 1000 * 60 * 60 * 6; // 6 hours
    }

    this.memoryCache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs,
    });

    this.save();
  }

  clear(): void {
    this.memoryCache.clear();
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch {}
  }
}

export const vetteCache = new VetteCache();
