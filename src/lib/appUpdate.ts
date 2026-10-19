import type { AppUpdateState } from '../types';

/** Text of the top-bar update button for each auto-update state. Pure (tested). */
export function updateButtonLabel(update: AppUpdateState | null, version: string): string {
  if (!update) return 'Mises à jour';
  switch (update.state) {
    case 'checking':
      return 'Recherche…';
    case 'up-to-date':
      return `À jour ✓${version ? ` (v${version})` : ''}`;
    case 'downloading':
      return `Téléchargement ${update.percent ?? 0} %`;
    case 'ready':
      return `v${update.version || ''} prête · Redémarrer`;
    case 'unavailable':
      return 'Mode développement';
    default:
      return 'Erreur de mise à jour';
  }
}

/** Tooltip of the update button. */
export function updateButtonTitle(update: AppUpdateState | null, version: string): string {
  if (update?.message) return update.message;
  if (update?.state === 'ready') return 'Redémarrer Agent Canvas pour installer la nouvelle version';
  return `Version installée : ${version || '?'} · cliquer pour rechercher une mise à jour`;
}
