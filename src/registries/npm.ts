import type { PackageMetadata } from '../types.js';

export async function fetchNpmMetadata(packageName: string): Promise<PackageMetadata> {
  const cleanName = packageName.trim();
  const encodedName = cleanName.startsWith('@')
    ? `@${encodeURIComponent(cleanName.slice(1))}`
    : encodeURIComponent(cleanName);

  const registryUrl = `https://registry.npmjs.org/${encodedName}`;
  const downloadsUrl = `https://api.npmjs.org/downloads/point/last-week/${encodedName}`;

  try {
    const [metaRes, dlRes] = await Promise.allSettled([
      fetch(registryUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      }),
      fetch(downloadsUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      }),
    ]);

    if (metaRes.status === 'rejected' || !metaRes.value.ok) {
      if (metaRes.status === 'fulfilled' && metaRes.value.status === 404) {
        return {
          name: cleanName,
          registry: 'npm',
          downloadsLastWeek: 0,
          maintainers: [],
          hasInstallScripts: false,
          installScripts: {},
          isNotFound: true,
        };
      }
      return {
        name: cleanName,
        registry: 'npm',
        downloadsLastWeek: 0,
        maintainers: [],
        hasInstallScripts: false,
        installScripts: {},
        isNotFound: false,
        error: metaRes.status === 'rejected' ? metaRes.reason?.message : `HTTP ${metaRes.value.status}`,
      };
    }

    const data = (await metaRes.value.json()) as any;
    let downloadsLastWeek = 0;

    if (dlRes.status === 'fulfilled' && dlRes.value.ok) {
      try {
        const dlData = (await dlRes.value.json()) as any;
        downloadsLastWeek = Number(dlData.downloads) || 0;
      } catch {
        downloadsLastWeek = 0;
      }
    }

    const latestTag = data['dist-tags']?.latest;
    const latestVersion = latestTag || Object.keys(data.versions || {}).pop();
    const versionObj = latestVersion ? data.versions?.[latestVersion] : null;

    // Check for dangerous lifecycle scripts
    const scripts = versionObj?.scripts || {};
    const dangerousKeys = ['preinstall', 'install', 'postinstall', 'preuninstall', 'postuninstall'];
    const installScripts: Record<string, string> = {};
    for (const key of dangerousKeys) {
      if (scripts[key]) {
        installScripts[key] = String(scripts[key]);
      }
    }

    const maintainers = Array.isArray(data.maintainers)
      ? data.maintainers.map((m: any) => m.name || m.email || JSON.stringify(m))
      : [];

    return {
      name: cleanName,
      registry: 'npm',
      latestVersion,
      createdAt: data.time?.created,
      latestPublishedAt: latestVersion && data.time?.[latestVersion] ? data.time[latestVersion] : data.time?.modified,
      author: data.author ? { name: data.author.name, email: data.author.email } : undefined,
      maintainers,
      downloadsLastWeek,
      hasInstallScripts: Object.keys(installScripts).length > 0,
      installScripts,
      isNotFound: false,
    };
  } catch (err: any) {
    return {
      name: cleanName,
      registry: 'npm',
      downloadsLastWeek: 0,
      maintainers: [],
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false,
      error: err?.message || 'Network error fetching npm metadata',
    };
  }
}
