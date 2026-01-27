import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getVersion, getPackageName } from './version.js';

interface UpdateCache {
  lastCheck: number;
  latestVersion: string | null;
}

const CACHE_DIR = join(homedir(), '.foundry');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Reads the cached update check result.
 */
function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }
    const data = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Writes the update check result to cache.
 */
function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Fetches the latest version from npm registry.
 * Returns null if the fetch fails.
 */
async function fetchLatestVersion(): Promise<string | null> {
  const packageName = getPackageName();
  const registryUrl = `https://registry.npmjs.org/${packageName}/latest`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(registryUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.version || null;
  } catch {
    // Network error, timeout, or parsing error
    return null;
  }
}

/**
 * Compares two semver versions.
 * Returns true if version2 is greater than version1.
 */
function isNewerVersion(current: string, latest: string): boolean {
  const parseVersion = (v: string) => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  };

  const c = parseVersion(current);
  const l = parseVersion(latest);

  if (l.major > c.major) return true;
  if (l.major < c.major) return false;
  if (l.minor > c.minor) return true;
  if (l.minor < c.minor) return false;
  return l.patch > c.patch;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
}

/**
 * Checks for available updates.
 * Uses a 24-hour cache to avoid excessive network requests.
 * Returns the current and latest versions, and whether an update is available.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getVersion();

  // Check cache first
  const cache = readCache();
  const now = Date.now();

  if (cache && now - cache.lastCheck < CHECK_INTERVAL_MS) {
    // Use cached result
    return {
      currentVersion,
      latestVersion: cache.latestVersion,
      updateAvailable: cache.latestVersion
        ? isNewerVersion(currentVersion, cache.latestVersion)
        : false,
    };
  }

  // Fetch from npm registry (non-blocking, with timeout)
  const latestVersion = await fetchLatestVersion();

  // Update cache
  writeCache({
    lastCheck: now,
    latestVersion,
  });

  return {
    currentVersion,
    latestVersion,
    updateAvailable: latestVersion ? isNewerVersion(currentVersion, latestVersion) : false,
  };
}

// ANSI color codes
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

/**
 * Displays an update notification if an update is available.
 * This is designed to be non-intrusive - just a simple message in yellow.
 */
export function displayUpdateNotification(result: UpdateCheckResult): void {
  if (!result.updateAvailable || !result.latestVersion) {
    return;
  }

  const packageName = getPackageName();

  console.log('');
  console.log(`${yellow}   Update available: ${result.currentVersion} → ${result.latestVersion}`);
  console.log(`   Run: npm install -g ${packageName}@latest${reset}`);
  console.log('');
}
