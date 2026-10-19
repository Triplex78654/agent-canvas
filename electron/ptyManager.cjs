const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const MAX_PAUSED_BUFFER = 256 * 1024;

function resolveWorkingDirectory(cwd) {
  try {
    if (typeof cwd === 'string' && cwd && fs.statSync(cwd).isDirectory()) return cwd;
  } catch (_) {}
  return os.homedir();
}

let nodePty = null;
try {
  nodePty = require('node-pty');
} catch (err) {
  console.warn('[PTY Manager] node-pty native module unavailable for this Electron ABI, using interactive shell bridge fallback:', err.message);
}

/**
 * Resolves the default shell and arguments for macOS, Windows, and Linux.
 */
function getDefaultShell() {
  const platform = os.platform();
  if (platform === 'win32') {
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo'],
    };
  }
  if (platform === 'darwin') {
    return {
      shell: process.env.SHELL || '/bin/zsh',
      args: ['-l'],
    };
  }
  return {
    shell: process.env.SHELL || '/bin/bash',
    args: ['-l'],
  };
}

/**
 * Metadata and smart launch commands for each AI CLI agent (including free & local models).
 */
const AGENT_CLI_SPECS = {
  agy: {
    binary: 'agy',
    cmd: 'agy --model gemini-4-argon-medium',
    installHint: 'agy install',
    title: 'Google Antigravity CLI (Gemini 4 Argon)',
  },
  claude: {
    binary: 'claude',
    cmd: 'claude',
    installHint: 'npm install -g @anthropic-ai/claude-code',
    title: 'Claude Code CLI',
  },
  codex: {
    binary: 'codex',
    cmd: 'codex',
    installHint: 'npm install -g @openai/codex',
    title: 'OpenAI Codex CLI',
  },
  gemini: {
    binary: 'gemini',
    cmd: 'gemini',
    installHint: 'npm install -g @google/gemini-cli',
    title: 'Google Gemini CLI (Free Tier disponible)',
  },
  qwen: {
    binary: 'qwen',
    cmd: 'qwen',
    installHint: 'npm install -g @qwen-code/qwen-code',
    title: 'Qwen Code CLI (Alibaba Qwen3-Coder · Gratuit)',
  },
  ollama: {
    binary: 'ollama',
    cmd: 'ollama run qwen2.5-coder',
    installHint: 'winget install Ollama.Ollama  (puis: ollama run qwen2.5-coder)',
    title: 'Ollama Local AI (100% Gratuit & Hors-ligne)',
  },
  kimi: {
    binary: 'kimi',
    cmd: 'kimi',
    installHint: 'pip install kimi-cli  (ou via OpenCode: npx opencode-ai)',
    title: 'Kimi K2 CLI (Moonshot AI · Gratuit)',
  },
  deepseek: {
    binary: 'ollama',
    cmd: 'ollama run deepseek-r1',
    installHint: 'winget install Ollama.Ollama  (puis: ollama run deepseek-r1)',
    title: 'DeepSeek R1 Local via Ollama (100% Gratuit)',
  },
  aider: {
    binary: 'aider',
    cmd: 'aider',
    installHint: 'python -m pip install aider-install && aider-install',
    title: 'Aider AI Pair Programmer (Open-Source & Gratuit)',
  },
  opencode: {
    binary: 'opencode',
    cmd: 'opencode',
    installHint: 'npm install -g opencode-ai  (ou: npx opencode-ai)',
    title: 'OpenCode CLI (Multi-modèles gratuits)',
  },
  shell: {
    binary: null,
    cmd: null,
    installHint: null,
    title: 'System Shell',
  },
};

/**
 * Builds a shell startup command that checks if the CLI tool is installed,
 * runs it if found, or displays a clean installation helper if missing.
 */
function buildSmartStartupCommand(commandType, customCommand) {
  if (customCommand && customCommand.trim()) {
    return customCommand.trim();
  }

  const spec = AGENT_CLI_SPECS[commandType];
  if (!spec || !spec.cmd) return null;

  const isWin = os.platform() === 'win32';
  if (isWin) {
    return `if (Get-Command ${spec.binary} -ErrorAction SilentlyContinue) { ${spec.cmd} } else { Write-Host "● ${spec.title}" -ForegroundColor Yellow; Write-Host "  L'outil '${spec.binary}' n'est pas encore installé sur cette machine." -ForegroundColor Gray; Write-Host "  ↳ Commande d'installation gratuite : " -NoNewline -ForegroundColor Cyan; Write-Host "${spec.installHint}" -ForegroundColor White }`;
  }

  return `if command -v ${spec.binary} >/dev/null 2>&1; then ${spec.cmd}; else printf "\\033[33m● ${spec.title}\\033[0m\\n  Outil '${spec.binary}' non détecté. Installation : \\033[36m${spec.installHint}\\033[0m\\n"; fi`;
}

class PtyManager {
  constructor(sendToRenderer) {
    this.sessions = new Map();
    this.sendToRenderer = sendToRenderer;
  }

  setStatus(id, status) {
    const session = this.sessions.get(id);
    if (session?.status === status) return;
    if (session) session.status = status;
    this.sendToRenderer('pty:status', { id, status });
  }

  spawnSession(id, options = {}) {
    const {
      commandType = 'claude',
      customCommand = '',
      cwd: requestedCwd,
      cols = 80,
      rows = 24,
      forceRestart = false,
      replayHistory = false,
    } = options;
    const cwd = resolveWorkingDirectory(requestedCwd);

    const existing = this.sessions.get(id);
    if (existing && !forceRestart && existing.commandType === commandType) {
      this.resizeSession(id, cols, rows);
      // Only replay history when a freshly mounted terminal needs it (never when sending a prompt).
      if (replayHistory && existing.historyBuffer) {
        setTimeout(() => {
          this.sendToRenderer('pty:data', { id, data: existing.historyBuffer, replay: true });
        }, 30);
      }
      return { ok: true, mode: existing.mode, reused: true };
    }

    this.killSession(id);

    const { shell, args } = getDefaultShell();
    const startupCmd = buildSmartStartupCommand(commandType, customCommand);

    const home = os.homedir();
    const extraPaths =
      os.platform() === 'win32'
        ? [
            `${home}\\.local\\bin`,
            `${home}\\AppData\\Local\\Programs\\Ollama`,
            `${home}\\AppData\\Roaming\\npm`,
            `${home}\\AppData\\Local\\nodejs`,
          ]
        : [`${home}/.local/bin`, '/usr/local/bin', '/opt/homebrew/bin'];

    const pathSep = os.platform() === 'win32' ? ';' : ':';
    const currentPath = process.env.PATH || process.env.Path || '';
    const enrichedPath = [...extraPaths, currentPath].join(pathSep);

    const env = {
      ...process.env,
      PATH: enrichedPath,
      Path: enrichedPath,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '3',
    };

    if (nodePty) {
      try {
        const ptyProcess = nodePty.spawn(shell, args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env,
        });

        const session = {
          id,
          mode: 'node-pty',
          process: ptyProcess,
          paused: false,
          commandType,
          status: 'idle',
          statusBuffer: '',
          buffer: '',
          historyBuffer: '',
          pausedBuffer: '',
          cols,
          rows,
        };

        ptyProcess.onData((data) => {
          if (this.sessions.get(id) !== session) return;
          session.historyBuffer = (session.historyBuffer + data).slice(-65536);
          if (session.paused) {
            session.pausedBuffer = (session.pausedBuffer + data).slice(-MAX_PAUSED_BUFFER);
            return;
          }
          this.sendToRenderer('pty:data', { id, data });
          this.inferStatusFromOutput(id, data);
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          // A killed/replaced process must never remove the session that replaced it.
          if (this.sessions.get(id) !== session) return;
          this.sessions.delete(id);
          this.sendToRenderer('pty:exit', { id, exitCode, signal });
          this.setStatus(id, exitCode && exitCode !== 0 ? 'error' : 'idle');
        });

        this.sessions.set(id, session);
        this.setStatus(id, 'running');

        if (startupCmd) {
          setTimeout(() => {
            if (this.sessions.has(id)) {
              const lineEnding = os.platform() === 'win32' ? '\r\n' : '\n';
              ptyProcess.write(`${startupCmd}${lineEnding}`);
            }
          }, 350);
        }

        return { ok: true, mode: 'node-pty', shell };
      } catch (ptyErr) {
        console.warn('[PTY Manager] Failed to spawn node-pty instance, falling back to child_process:', ptyErr.message);
      }
    }

    return this.spawnFallbackSession(id, { shell, commandType, startupCmd, cwd, env });
  }

  spawnFallbackSession(id, { shell, commandType, startupCmd, cwd, env }) {
    const isWin = os.platform() === 'win32';
    const shellArgs = isWin
      ? ['-NoLogo', '-NoExit', '-Command', '-']
      : ['-i'];

    const child = spawn(shell, shellArgs, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const session = {
      id,
      mode: 'child_process',
      process: child,
      paused: false,
      commandType,
      status: 'idle',
      statusBuffer: '',
      lineBuffer: '',
      pausedBuffer: '',
    };

    const banner =
      `\x1b[38;2;255;106;61m● Agent Canvas Terminal\x1b[0m \x1b[90m(${shell} · ${cwd})\x1b[0m\r\n` +
      (startupCmd
        ? `\x1b[90m↳ Démarrage de l'agent :\x1b[0m \x1b[1;37m${commandType}\x1b[0m\r\n\r\n`
        : `\x1b[90m↳ Shell interactif prêt.\x1b[0m\r\n\x1b[38;2;255;106;61m❯\x1b[0m `);

    setTimeout(() => {
      this.sendToRenderer('pty:data', { id, data: banner });
    }, 80);

    const handleChunk = (chunk, isError = false) => {
      if (this.sessions.get(id) !== session) return;
      const raw = chunk.toString('utf8');
      const normalized = raw.replace(/\r?\n/g, '\r\n');
      const formatted = isError ? `\x1b[38;2;239;68;68m${normalized}\x1b[0m` : normalized;
      if (session.paused) {
        session.pausedBuffer = (session.pausedBuffer + formatted).slice(-MAX_PAUSED_BUFFER);
        return;
      }
      this.sendToRenderer('pty:data', { id, data: formatted });
      this.inferStatusFromOutput(id, raw, isError);
    };

    child.stdout.on('data', (chunk) => handleChunk(chunk, false));
    child.stderr.on('data', (chunk) => handleChunk(chunk, true));

    child.on('exit', (exitCode, signal) => {
      if (this.sessions.get(id) !== session) return;
      this.sessions.delete(id);
      this.sendToRenderer('pty:exit', { id, exitCode, signal });
      this.setStatus(id, exitCode && exitCode !== 0 ? 'error' : 'idle');
    });

    child.on('error', (err) => {
      if (this.sessions.get(id) !== session) return;
      this.sendToRenderer('pty:data', { id, data: `\x1b[31m[Erreur shell] ${err.message}\x1b[0m\r\n` });
      this.setStatus(id, 'error');
    });

    this.sessions.set(id, session);
    this.setStatus(id, 'running');

    if (startupCmd) {
      setTimeout(() => {
        if (this.sessions.has(id)) {
          this.writeToSession(id, `${startupCmd}\r`);
        }
      }, 300);
    }

    return { ok: true, mode: 'child_process', shell };
  }

  inferStatusFromOutput(id, text, isError = false) {
    const lower = text.toLowerCase();
    if (isError && (lower.includes('error') || lower.includes('not recognized') || lower.includes('command not found') || lower.includes('introuvable'))) {
      this.setStatus(id, 'error');
      return;
    }

    const session = this.sessions.get(id);
    if (!session) return;
    session.statusBuffer = `${session.statusBuffer || ''}${text}`.slice(-2400);
    const plainText = session.statusBuffer
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/\r/g, '\n');
    const lastLine = plainText.split('\n').pop()?.trim() || '';
    const isCliPrompt =
      /^(?:❯|›|>|\$|#|%|>>>?)$/.test(lastLine) ||
      /^(?:PS\s+.{1,180}|[A-Za-z]:\\[^\r\n]{0,180})>$/.test(lastLine) ||
      /(?:\((?:y|yes)\/(?:n|no)\)|\[(?:y|yes)\/(?:n|no)\])$/i.test(lastLine);

    if (isCliPrompt && session.status !== 'waiting') {
      this.setStatus(id, 'waiting');
      this.sendToRenderer('pty:prompt', { id });
    }
  }

  writeToSession(id, data) {
    const session = this.sessions.get(id);
    if (!session || session.paused) return false;

    if (session.mode === 'node-pty') {
      if (/[\r\n]/.test(data)) {
        session.statusBuffer = '';
        this.setStatus(id, 'running');
      }
      session.process.write(data);
      return true;
    }

    for (const ch of data) {
      if (ch === '\r' || ch === '\n') {
        this.sendToRenderer('pty:data', { id, data: '\r\n' });
        const cmd = session.lineBuffer.trim();
        session.lineBuffer = '';
        session.statusBuffer = '';

        if (cmd === 'clear' || cmd === 'cls') {
          this.sendToRenderer('pty:data', { id, data: '\x1b[2J\x1b[H\x1b[38;2;255;106;61m❯\x1b[0m ' });
          continue;
        }

        this.setStatus(id, 'running');
        session.process.stdin.write(cmd + '\n');
      } else if (ch === '\u007f' || ch === '\b') {
        if (session.lineBuffer.length > 0) {
          session.lineBuffer = session.lineBuffer.slice(0, -1);
          this.sendToRenderer('pty:data', { id, data: '\b \b' });
        }
      } else if (ch === '\u0003') {
        session.lineBuffer = '';
        this.sendToRenderer('pty:data', { id, data: '^C\r\n\x1b[38;2;255;106;61m❯\x1b[0m ' });
        this.setStatus(id, 'waiting');
      } else {
        session.lineBuffer += ch;
        this.sendToRenderer('pty:data', { id, data: ch });
      }
    }
    return true;
  }

  resizeSession(id, cols, rows) {
    const session = this.sessions.get(id);
    if (!session) return;
    const nextCols = Math.max(20, cols);
    const nextRows = Math.max(5, rows);
    // Windows ConPTY repaints the whole visible screen on every resize, even to the same size:
    // that repaint was re-sent as "new output" and old text leaked into agent replies.
    if (session.cols === nextCols && session.rows === nextRows) return;
    if (session.mode === 'node-pty' && typeof session.process.resize === 'function') {
      try {
        session.process.resize(nextCols, nextRows);
        session.cols = nextCols;
        session.rows = nextRows;
      } catch (_) {}
    }
  }

  setPaused(id, paused) {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.paused = Boolean(paused);
    if (!session.paused && session.pausedBuffer) {
      // Flush everything the agent printed while the console was paused.
      const buffered = session.pausedBuffer;
      session.pausedBuffer = '';
      this.setStatus(id, 'running');
      this.sendToRenderer('pty:data', { id, data: buffered });
      // Re-evaluate the status from what was printed during the pause (may switch to "waiting").
      session.statusBuffer = '';
      this.inferStatusFromOutput(id, buffered);
      return session.paused;
    }
    this.setStatus(id, session.paused ? 'waiting' : 'running');
    return session.paused;
  }

  killSession(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    // Remove first so the dying process's exit/data events are ignored.
    this.sessions.delete(id);
    try {
      session.process.kill();
    } catch (_) {}
  }

  killAll() {
    for (const id of Array.from(this.sessions.keys())) {
      this.killSession(id);
    }
  }
}

/** PATH used for terminals (and CLI detection): user-level install dirs are not always in Electron's PATH. */
function buildEnrichedPath() {
  const home = os.homedir();
  const extraPaths =
    os.platform() === 'win32'
      ? [`${home}\\.local\\bin`, `${home}\\AppData\\Local\\Programs\\Ollama`, `${home}\\AppData\\Roaming\\npm`, `${home}\\AppData\\Local\\nodejs`]
      : [`${home}/.local/bin`, '/usr/local/bin', '/opt/homebrew/bin'];
  const sep = os.platform() === 'win32' ? ';' : ':';
  return [...extraPaths, process.env.PATH || process.env.Path || ''].join(sep);
}

/** Which AI CLIs are installed on this machine (used by the first-launch screen). */
function detectInstalledClis() {
  const { execFile } = require('child_process');
  const isWin = os.platform() === 'win32';
  const env = { ...process.env, PATH: buildEnrichedPath(), Path: buildEnrichedPath() };
  const entries = Object.entries(AGENT_CLI_SPECS).filter(([, spec]) => spec.binary);
  return Promise.all(
    entries.map(
      ([id, spec]) =>
        new Promise((resolve) => {
          const cmd = isWin ? 'where.exe' : 'which';
          execFile(cmd, [spec.binary], { env, windowsHide: true, timeout: 5000 }, (err, stdout) => {
            const found = !err && String(stdout).trim().length > 0;
            resolve({
              id,
              binary: spec.binary,
              title: spec.title,
              installHint: spec.installHint,
              installed: found,
              path: found ? String(stdout).split(/\r?\n/)[0].trim() : null,
            });
          });
        })
    )
  );
}

module.exports = { PtyManager, detectInstalledClis };
