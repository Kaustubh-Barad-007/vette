import type { PackageMetadata } from '../types.js';

export async function fetchPypiMetadata(packageName: string): Promise<PackageMetadata> {
  const cleanName = packageName.trim().toLowerCase();
  const url = `https://pypi.org/pypi/${encodeURIComponent(cleanName)}/json`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          name: cleanName,
          registry: 'pypi',
          downloadsLastWeek: 0,
          maintainers: [],
          hasInstallScripts: false,
          installScripts: {},
          isNotFound: true,
        };
      }
      return {
        name: cleanName,
        registry: 'pypi',
        downloadsLastWeek: 0,
        maintainers: [],
        hasInstallScripts: false,
        installScripts: {},
        isNotFound: false,
        error: `PyPI HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as any;
    const info = data.info || {};
    const latestVersion = info.version;

    // PyPI release times
    const releaseFiles = (data.releases && latestVersion && data.releases[latestVersion]) || [];
    let latestPublishedAt: string | undefined;
    if (releaseFiles.length > 0 && releaseFiles[0].upload_time_iso_8601) {
      latestPublishedAt = releaseFiles[0].upload_time_iso_8601;
    }

    // Earliest release
    let createdAt = latestPublishedAt;
    if (data.releases) {
      const allUploadDates: string[] = [];
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

    const maintainers: string[] = [];
    if (info.author) maintainers.push(info.author);
    if (info.maintainer) maintainers.push(info.maintainer);

    return {
      name: cleanName,
      registry: 'pypi',
      latestVersion,
      createdAt,
      latestPublishedAt,
      author: {
        name: info.author || info.maintainer,
        email: info.author_email || info.maintainer_email,
      },
      maintainers,
      downloadsLastWeek: 0, // PyPI removed download counts from its JSON API; handled in heuristics
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false,
    };
  } catch (err: any) {
    return {
      name: cleanName,
      registry: 'pypi',
      downloadsLastWeek: 0,
      maintainers: [],
      hasInstallScripts: false,
      installScripts: {},
      isNotFound: false,
      error: err?.message || 'Network error fetching PyPI metadata',
    };
  }
}
