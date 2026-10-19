import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Terminal,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  searchAllTerminalScrollbacks,
  TerminalSearchMatch,
} from '../services/teamCollabBus';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeMetaMap: Map<string, { label: string; commandType: string }>;
  onFocusNode: (nodeId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  nodeMetaMap,
  onFocusNode,
}) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    return searchAllTerminalScrollbacks(query, nodeMetaMap);
  }, [query, nodeMetaMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-[#1c1a22] border border-[#2d2a37] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Header with Search Input */}
        <div className="p-4 border-b border-[#2d2a37] flex items-center gap-3 bg-[#14121a]">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#ff6a3d]/15 text-[#ff6a3d] border border-[#ff6a3d]/30">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans tous les terminaux (erreurs, URLs, logs, fonctions)..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {query.trim().length < 2 ? (
            <div className="py-12 text-center text-zinc-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-500" />
              <p className="text-xs">Tape au moins 2 caractères pour scanner tous les terminaux simultanément.</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Astuce : Recherche "error", "http://", "warning", ou le nom d’un fichier modifié.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <p className="text-xs font-medium text-zinc-300">Aucune occurrence trouvée pour "{query}"</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Vérifie que les consoles ont bien généré des sorties dans cette session.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1 text-[11px] font-mono text-zinc-400">
                <span>{matches.length} résultat{matches.length > 1 ? 's' : ''} trouvé{matches.length > 1 ? 's' : ''}</span>
                <span>Cliquer pour centrer la console</span>
              </div>

              {matches.map((m: TerminalSearchMatch, idx: number) => (
                <div
                  key={`${m.nodeId}-${m.lineNumber}-${idx}`}
                  onClick={() => {
                    onFocusNode(m.nodeId);
                    onClose();
                  }}
                  className="group p-3 rounded-2xl bg-[#14121a]/90 hover:bg-[#ff6a3d]/10 border border-[#2d2a37] hover:border-[#ff6a3d]/50 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-[#ff6a3d]" />
                      <span className="font-semibold text-zinc-200">{m.label}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1a22] text-zinc-400 border border-[#2d2a37]">
                        {m.commandType}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 group-hover:text-[#ff6a3d] flex items-center gap-1 transition-colors">
                      <span>Ligne {m.lineNumber}</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>

                  <p className="font-mono text-xs text-zinc-300 bg-[#100e14] p-2 rounded-xl border border-zinc-800/80 truncate">
                    {m.preview}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2d2a37] bg-[#14121a] flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#ff6a3d]" />
            Scan multi-agents en direct
          </span>
          <span className="font-mono">Raccourci : Ctrl+Shift+F</span>
        </div>
      </div>
    </div>
  );
};
