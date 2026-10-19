import React, { useState } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Folder,
  FileCode2,
  RefreshCw,
  Send,
  X,
  Check,
  FilePlus,
  FileDiff,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export interface WorkspaceNodeData extends Record<string, unknown> {
  projectPath: string;
  branchName: string;
  lastCommitMessage?: string;
  modifiedFiles: Array<{ name: string; status: 'modified' | 'added' | 'deleted' }>;
  onInjectContextToTeam?: (contextSummary: string) => void;
  onChangePath?: (newPath: string) => void;
  onGitInfo?: (info: { branchName: string }) => void;
  onClose?: (id: string) => void;
}

type GitFile = { name: string; status: 'modified' | 'added' | 'deleted' };

export const WorkspaceNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const ws = data as unknown as WorkspaceNodeData;
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [draftPath, setDraftPath] = useState(ws.projectPath || '');
  const [injectedFeedback, setInjectedFeedback] = useState(false);
  const [gitFiles, setGitFiles] = useState<GitFile[]>([]);
  const [totalModified, setTotalModified] = useState(0);
  const [branchName, setBranchName] = useState(ws.branchName || '');
  const [lastCommit, setLastCommit] = useState('');
  const [gitError, setGitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const api = typeof window !== 'undefined' ? window.agentCanvasAPI : undefined;
  const canReadGit = Boolean(api?.getGitStatus);
  const projectPath = ws.projectPath || '';
  const onGitInfoRef = React.useRef(ws.onGitInfo);
  onGitInfoRef.current = ws.onGitInfo;

  React.useEffect(() => {
    if (!isEditingPath) {
      setDraftPath(projectPath);
    }
  }, [projectPath, isEditingPath]);

  const refreshGit = React.useCallback(async () => {
    if (!projectPath || !api?.getGitStatus) return;
    setLoading(true);
    try {
      const res = await api.getGitStatus(projectPath);
      if (res.ok) {
        setGitError(null);
        setGitFiles(res.modifiedFiles || []);
        setTotalModified(res.totalModified ?? res.modifiedFiles?.length ?? 0);
        setBranchName(res.branchName || '');
        setLastCommit(res.lastCommitMessage || '');
        if (res.branchName) onGitInfoRef.current?.({ branchName: res.branchName });
      } else {
        setGitError(res.error || 'Lecture git impossible.');
        setGitFiles([]);
        setTotalModified(0);
        setLastCommit('');
      }
    } catch (err) {
      setGitError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath, api]);

  // Read the real git status when the folder changes, then every 15s while the panel is open.
  React.useEffect(() => {
    refreshGit();
    if (!projectPath || !canReadGit) return;
    const timer = setInterval(refreshGit, 15000);
    return () => clearInterval(timer);
  }, [refreshGit, projectPath, canReadGit]);

  const handleInject = () => {
    if (!projectPath) return;
    const summary = `[CONTEXTE PROJET ACTIF]\nChemin : ${projectPath}\nBranche Git : ${
      branchName || 'inconnue'
    }${lastCommit ? `\nDernier commit : ${lastCommit}` : ''}\nFichiers modifiés (${totalModified}) :\n${
      gitFiles.length
        ? gitFiles
            .slice(0, 40)
            .map((f) => `- [${f.status.toUpperCase()}] ${f.name}`)
            .join('\n')
        : '- (aucun)'
    }`;

    ws.onInjectContextToTeam?.(summary);
    setInjectedFeedback(true);
    setTimeout(() => setInjectedFeedback(false), 2000);
  };

  const handleCommitPath = () => {
    ws.onChangePath?.(draftPath.trim());
    setIsEditingPath(false);
  };

  const handlePickFolder = async () => {
    if (!api?.pickFolder) {
      setIsEditingPath(true);
      return;
    }
    const picked = await api.pickFolder();
    if (picked) ws.onChangePath?.(picked);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full h-full rounded-3xl transition-colors duration-200 relative flex flex-col bg-[#1c1a22]/95 border ${
        selected
          ? 'border-[#ff6a3d] shadow-[0_0_28px_-4px_rgba(255,106,61,0.5)]'
          : 'border-[#2d2a37] shadow-card'
      }`}
    >
      <NodeResizer
        minWidth={320}
        minHeight={280}
        autoScale={false}
        isVisible={selected || isHovered}
        lineClassName="!border-[#ff6a3d]/60"
        handleClassName="!w-3 !h-3 !bg-[#ff6a3d] !border-2 !border-[#14121a] !rounded-full"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#ff6a3d] !border-2 !border-[#14121a]"
      />

      {/* Header Bar */}
      <div className="workspace-drag-handle flex items-center justify-between px-4 py-2.5 rounded-t-3xl bg-[#14121a] border-b border-[#2d2a37] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
              <span>Projet & Git Workspace</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1 nodrag">
          {canReadGit && projectPath && (
            <button
              onClick={refreshGit}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Rafraîchir le statut git"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => ws.onClose?.(id)}
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Fermer le panneau workspace"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Git Branch & Commit Status */}
      <div className="px-3.5 py-2 bg-[#171520] border-b border-[#24212e] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
          <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-emerald-300">{branchName || '—'}</span>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#100e16] border border-[#2d2a37] text-zinc-400 flex items-center gap-1 max-w-[60%] truncate"
          title={lastCommit || undefined}
        >
          <GitCommit className="w-3 h-3 text-[#ff6a3d] shrink-0" />
          <span>{totalModified} modif{totalModified > 1 ? 's' : ''}</span>
        </span>
      </div>

      {/* Path bar */}
      <div className="px-3.5 py-2 border-b border-[#24212e] bg-[#121017]">
        {isEditingPath ? (
          <div className="flex items-center gap-1.5 nodrag">
            <input
              type="text"
              value={draftPath}
              onChange={(e) => setDraftPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitPath();
                if (e.key === 'Escape') setIsEditingPath(false);
              }}
              autoFocus
              className="flex-1 bg-[#1c1a22] text-zinc-100 text-[11px] font-mono px-2 py-1 rounded border border-[#ff6a3d] focus:outline-none"
            />
            <button
              onClick={handleCommitPath}
              className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 nodrag">
            <span
              onDoubleClick={() => setIsEditingPath(true)}
              className="truncate max-w-[240px] text-zinc-300 cursor-pointer hover:text-zinc-100"
              title={projectPath ? `${projectPath} (double-clic pour taper un chemin)` : 'Aucun dossier choisi'}
            >
              📁 {projectPath || 'Aucun dossier choisi'}
            </span>
            <button
              onClick={handlePickFolder}
              className="text-[10px] px-2 py-0.5 rounded border border-[#2d2a37] text-zinc-300 hover:border-[#ff6a3d] hover:text-white shrink-0"
            >
              {projectPath ? 'Changer' : 'Choisir…'}
            </button>
          </div>
        )}
      </div>

      {/* Modified Files List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1.5 font-mono text-[11px]">
        <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mb-1 flex items-center gap-1">
          <FileDiff className="w-3 h-3 text-[#ff6a3d]" />
          <span>Fichiers modifiés dans le repo</span>
        </div>

        {projectPath && (
          <p className="text-[10px] text-zinc-500 font-sans leading-snug mb-1">
            Les consoles se lancent dans ce dossier (redémarre une console déjà lancée pour l'appliquer).
          </p>
        )}
        {!projectPath && (
          <p className="text-[11px] text-zinc-400 font-sans leading-snug">
            Choisis le dossier de ton projet : les consoles s'y lanceront et ce panneau affichera le vrai statut git.
          </p>
        )}
        {projectPath && !canReadGit && (
          <p className="text-[11px] text-zinc-500 font-sans">Le statut git n'est disponible que dans l'app desktop.</p>
        )}
        {gitError && <p className="text-[11px] text-amber-300 font-sans leading-snug">{gitError}</p>}
        {projectPath && canReadGit && !gitError && !loading && gitFiles.length === 0 && (
          <p className="text-[11px] text-emerald-300/80 font-sans">✓ Rien à commiter, le dépôt est propre.</p>
        )}

        {gitFiles.map((file, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-1.5 rounded-lg bg-[#14121a] border border-[#24212e] hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <FileCode2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-zinc-200 truncate">{file.name}</span>
            </div>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                file.status === 'added'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : file.status === 'deleted'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {file.status}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: Inject into Team Prompt */}
      <div className="p-3 border-t border-[#2d2a37] bg-[#14121a] flex items-center justify-between">
        <button
          onClick={handleInject}
          disabled={!projectPath}
          className="disabled:opacity-40 disabled:cursor-not-allowed w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 text-xs font-semibold transition-all cursor-pointer"
        >
          {injectedFeedback ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300">Contexte injecté !</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Injecter Git Context dans l'Équipe</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
