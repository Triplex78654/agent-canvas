import React from 'react';
import type { AppUpdateState } from '../types';
import { updateButtonLabel, updateButtonTitle } from '../lib/appUpdate';

interface AppUpdateButtonProps {
  update: AppUpdateState | null;
  version: string;
  onClick: () => void;
}

/** Desktop app: check / download / install updates without leaving the app. */
export const AppUpdateButton: React.FC<AppUpdateButtonProps> = ({ update, version, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-xl shadow-card text-xs transition-colors cursor-pointer border ${
      update?.state === 'ready'
        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-200 animate-pulse'
        : update?.state === 'error'
        ? 'bg-red-500/10 border-red-500/40 text-red-300'
        : 'bg-[#1c1a22]/90 hover:bg-[#24212c] border-[#2d2a37] text-zinc-200'
    }`}
    title={updateButtonTitle(update, version)}
  >
    <span className="font-semibold">{updateButtonLabel(update, version)}</span>
  </button>
);
