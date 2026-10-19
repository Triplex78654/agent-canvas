export interface AppVersionInfo {
  version: string;
  buildTime: number;
  buildDate: string;
  description?: string;
}

// Default fallback timestamp if version.json cannot be fetched
let currentVersionInfo: AppVersionInfo = {
  version: '1.3.0',
  buildTime: 0,
  buildDate: new Date().toISOString(),
  description: 'Auto-sélection intelligente des meilleures IA & Répartition rapide',
};

let hasInitializedVersion = false;

export function getCurrentVersionInfo(): AppVersionInfo {
  return currentVersionInfo;
}

/**
 * Initializes the current loaded version on app mount, then checks for updates
 */
export async function initializeVersionTracker(): Promise<AppVersionInfo | null> {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') return null;
  try {
    const res = await fetch(`/version.json?_init=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data: AppVersionInfo = await res.json();
      if (data && typeof data.buildTime === 'number') {
        currentVersionInfo = data;
        hasInitializedVersion = true;
        return data;
      }
    }
  } catch (err) {
    console.warn('[updateManager] Version init warning:', err);
  }
  return null;
}

/**
 * Checks if a newer version has been deployed to Cloudflare Pages
 */
export async function checkForAppUpdate(): Promise<{
  hasUpdate: boolean;
  currentBuildTime: number;
  remoteBuildTime?: number;
  remoteInfo?: AppVersionInfo;
}> {
  // Installed desktop app (file://): updates come from GitHub releases via electron-updater instead.
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return { hasUpdate: false, currentBuildTime: currentVersionInfo.buildTime };
  }
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) {
      return { hasUpdate: false, currentBuildTime: currentVersionInfo.buildTime };
    }
    const remoteData: AppVersionInfo = await res.json();
    if (remoteData && typeof remoteData.buildTime === 'number') {
      if (!hasInitializedVersion || currentVersionInfo.buildTime === 0) {
        currentVersionInfo = remoteData;
        hasInitializedVersion = true;
        return {
          hasUpdate: false,
          currentBuildTime: remoteData.buildTime,
          remoteBuildTime: remoteData.buildTime,
          remoteInfo: remoteData,
        };
      }

      const hasUpdate = remoteData.buildTime > currentVersionInfo.buildTime;
      return {
        hasUpdate,
        currentBuildTime: currentVersionInfo.buildTime,
        remoteBuildTime: remoteData.buildTime,
        remoteInfo: remoteData,
      };
    }
  } catch (err) {
    console.warn('[updateManager] Check for update failed:', err);
  }
  return { hasUpdate: false, currentBuildTime: currentVersionInfo.buildTime };
}

/**
 * Purges all Service Worker caches and CacheStorage, then triggers a hard browser reload
 * API credentials must never be carried in URL fragments. They remain in local storage.
 */
export async function forceAppUpdateAndRestart() {
  try {
    // 1. Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 2. Clear all cache storage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.warn('[updateManager] Cache cleanup warning:', e);
  }

  // 3. Force clean reload with cache-busting query parameter
  const base = window.location.origin + window.location.pathname;
  const freshUrl = `${base}?updated=${Date.now()}`;
  window.location.replace(freshUrl);
}
