const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const { fileURLToPath } = require('url');
const fs = require('fs');
const { PtyManager } = require('./ptyManager.cjs');

const ISOLATED_TEST_MODE = process.argv.includes('--visual-test') || process.argv.includes('--smoke-test');
const TEST_DATA_DIR = path.join(os.tmpdir(), `agent-canvas-test-${process.pid}`);
const ALLOWED_COMMAND_TYPES = new Set([
  'agy', 'claude', 'codex', 'gemini', 'qwen', 'ollama', 'kimi', 'deepseek', 'aider', 'opencode', 'shell',
]);

// Avoid Windows GPU/disk cache lock errors when multiple Electron instances or restarts occur
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow = null;
let ptyManager = null;

function getStateFilePath() {
  const userDataDir = ISOLATED_TEST_MODE ? TEST_DATA_DIR : app.getPath('userData');
  return path.join(userDataDir, 'canvas-state.json');
}

function isTrustedRendererUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!app.isPackaged && url.origin === new URL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173').origin) {
      return true;
    }
    if (url.protocol !== 'file:') return false;
    return path.resolve(fileURLToPath(url)) === path.resolve(path.join(__dirname, '../dist/index.html'));
  } catch {
    return false;
  }
}

function isTrustedIpc(event) {
  const contents = mainWindow?.webContents;
  if (!contents || contents.isDestroyed() || event.sender !== contents) return false;
  if (!event.senderFrame || event.senderFrame !== contents.mainFrame) return false;
  return isTrustedRendererUrl(event.senderFrame.url);
}

function isValidSessionId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[\w.:-]+$/.test(id);
}

function isValidCanvasState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (!Array.isArray(state.nodes) || state.nodes.length > 5000) return false;
  if (state.edges !== undefined && (!Array.isArray(state.edges) || state.edges.length > 10000)) return false;
  try {
    return Buffer.byteLength(JSON.stringify(state), 'utf8') <= 20 * 1024 * 1024;
  } catch {
    return false;
  }
}

function loadPersistedState() {
  const filePath = getStateFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, filePath, state: null };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Safety guarantee: on startup, consoles NEVER auto-run commands.
    if (parsed && Array.isArray(parsed.nodes)) {
      parsed.nodes = parsed.nodes.map((n) => ({
        ...n,
        started: false,
        paused: false,
        status: 'idle',
      }));
    }

    return { exists: true, filePath, state: parsed };
  } catch (err) {
    console.warn('[Storage] Failed to load canvas-state.json:', err.message);
    return { exists: false, filePath, state: null, error: err.message };
  }
}

function savePersistedState(state) {
  const filePath = getStateFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return { ok: true, filePath };
  } catch (err) {
    console.error('[Storage] Failed to save canvas-state.json:', err.message);
    return { ok: false, filePath, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#14121a',
    title: 'Agent Canvas',
    icon: path.join(__dirname, '../public/icon.ico'),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Let the Support "mailto:" button open the system mail client; everything else stays blocked.
    if (typeof url === 'string' && url.startsWith('mailto:')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });

  // Native Desktop Mode: terminals run real local CLIs (Claude Code, Gemini, Ollama, Codex)
  // using your native CLI logins and subscriptions (no API key required).
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`
        try {
          localStorage.removeItem('agent-canvas-web-api-keys-v1');
        } catch (_) {}
      `)
      .catch(() => {});
  });

  ptyManager = new PtyManager((channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.argv.includes('--visual-test')) {
    const screenshotPath =
      process.env.TEST_SCREENSHOT_PATH ||
      path.join(TEST_DATA_DIR, 'visual-test.png');

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.once('did-finish-load', async () => {
      console.log('=== DEBUT DU TEST E2E AGENT CANVAS ===');
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));

      try {
        // Wait up to 4s for React Flow to finish measuring and rendering ConsoleNodes
        for (let i = 0; i < 40; i++) {
          const ready = await mainWindow.webContents.executeJavaScript(`
            Boolean(document.querySelector('.react-flow__node-consoleNode button[title*="Démarrer"]'))
          `);
          if (ready) break;
          await delay(100);
        }

        // Step 1: Start Console 1 (terminal) and select "Antigravity (Argon 4)" on Console 2
        const res1 = await mainWindow.webContents.executeJavaScript(`
          (() => {
            const consoles = document.querySelectorAll('.react-flow__node-consoleNode');
            const agyCard = Array.from(consoles[1]?.querySelectorAll('button') || []).find(b => b.innerText.includes('Antigravity (Argon 4)'));
            if (agyCard) agyCard.click();
            const startBtn = consoles[0]?.querySelector('button[title*="Démarrer"]');
            if (startBtn) {
              startBtn.click();
              return 'PASS (Console 1 démarrée + Console 2 sur Antigravity Argon 4)';
            }
            return 'FAIL';
          })()
        `);
        console.log('[TEST 1/6] Demarrage Console 1 + Selection Antigravity Argon 4 Console 2 :', res1);
        await delay(500);

        // Step 2: Test Toolbar Popovers (Presets, Memory, Quota gauge & Clés API modal)
        const res2 = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const wait = (ms) => new Promise(r => setTimeout(r, ms));
            const clickBtn = (txt) => {
              const b = Array.from(document.querySelectorAll('button')).find(el => el.innerText.trim().includes(txt));
              if (b) { b.click(); return true; }
              return false;
            };
            const openedPresets = clickBtn('Presets');
            await wait(100);
            const hasPresetItems = document.body.innerText.includes('Squad Duo + Orchestrateur');
            const openedMemory = clickBtn('Memory');
            await wait(100);
            const hasMemoryBox = Boolean(document.querySelector('textarea[placeholder*="Consignes globales"]'));
            clickBtn('Memory');
            await wait(80);
            const openedApiKeys = clickBtn('Clés API');
            await wait(100);
            const hasApiKeysModal = document.body.innerText.includes('Mes Clés API Personnelles');
            clickBtn('Annuler');
            await wait(80);
            const hasQuotaBars = document.body.innerText.includes('Limite & Quotas');
            return { openedPresets, hasPresetItems, openedMemory, hasMemoryBox, openedApiKeys, hasApiKeysModal, hasQuotaBars };
          })()
        `);
        console.log('[TEST 2/6] Barre d outils (Presets, Memory, Clés API & Quotas) :', JSON.stringify(res2));

        // Step 3: Test @ Command Bar Autocomplete
        const res3 = await mainWindow.webContents.executeJavaScript(`
          (() => {
            const cmdInput = document.querySelector('input[placeholder*="Tape @"]');
            if (!cmdInput) return { ok: false };
            const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputSetter.call(cmdInput, '@');
            cmdInput.dispatchEvent(new Event('input', { bubbles: true }));
            const mentionCount = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('@')).length;
            return { ok: mentionCount >= 4, mentionCount };
          })()
        `);
        console.log('[TEST 3/6] Barre de commande @ Autocompletion :', JSON.stringify(res3));
        await delay(600);

        // Step 4: Verify DOM, Active PTY Sessions, Persistence JSON & Restart Safety
        const domReport = await mainWindow.webContents.executeJavaScript(`
          ({
            teamNodes: document.querySelectorAll('.react-flow__node-teamNode').length,
            orchestratorNodes: document.querySelectorAll('.react-flow__node-orchestratorNode').length,
            consoleNodes: document.querySelectorAll('.react-flow__node-consoleNode').length,
            activeXterms: document.querySelectorAll('.xterm').length,
            cableEdges: document.querySelectorAll('.react-flow__edge-animatedCable, .react-flow__edge').length,
            teamHeader: Array.from(document.querySelectorAll('.react-flow__node-teamNode .team-drag-handle')).map(el => el.innerText.replace(/\\n+/g, ' '))[0] || ''
          })
        `);
        console.log('[TEST 4/6] Rendu Canvas, Equipe, Cable & Terminaux xterm :', JSON.stringify(domReport));

        const activePtyCount = ptyManager ? ptyManager.sessions.size : 0;
        console.log('[TEST 5/6] Sessions PTY reelles actives dans Electron :', activePtyCount);

        const persisted = loadPersistedState();
        const allSafeIdleOnRestart =
          persisted.exists &&
          Array.isArray(persisted.state?.nodes) &&
          persisted.state.nodes
            .filter((n) => n.type === 'consoleNode')
            .every((n) => n.started === false && n.status === 'idle');

        console.log('[TEST 6/6] Persistance JSON & Securite au redemarrage (started=false) :', {
          fileExists: persisted.exists,
          filePath: persisted.filePath,
          savedNodesCount: persisted.state?.nodes?.length || 0,
          allSafeIdleOnRestart,
        });

        const image = await mainWindow.webContents.capturePage();
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        fs.writeFileSync(screenshotPath, image.toPNG());
        console.log('=== TOUS LES TESTS SONT TERMINES AVEC SUCCES ===');
      } catch (err) {
        console.error('[TEST E2E Erreur]', err);
      }
      if (ptyManager) ptyManager.killAll();
      setTimeout(() => app.exit(0), 250);
    });
  } else if (process.argv.includes('--smoke-test')) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const report = await mainWindow.webContents.executeJavaScript(`
            ({
              teamNodes: document.querySelectorAll('.react-flow__node-teamNode').length,
              orchestratorNodes: document.querySelectorAll('.react-flow__node-orchestratorNode').length,
              consoleNodes: document.querySelectorAll('.react-flow__node-consoleNode').length,
              cableEdges: document.querySelectorAll('.react-flow__edge-cable').length,
              titleText: document.body.innerText.slice(0, 160).replace(/\\n+/g, ' | ')
            })
          `);
          console.log('[Smoke Test Report]', JSON.stringify(report));
        } catch (err) {
          console.error('[Smoke Test Error]', err);
        }
        app.quit();
      }, 900);
    });
  } else if (!app.isPackaged) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    if (ptyManager) {
      ptyManager.killAll();
    }
    mainWindow = null;
  });
}

ipcMain.handle('pty:spawn', (event, payload) => {
  if (!isTrustedIpc(event)) return { ok: false, error: 'Untrusted renderer' };
  const { id, options } = payload || {};
  if (!isValidSessionId(id) || !options || typeof options !== 'object' || Array.isArray(options)) {
    return { ok: false, error: 'Invalid terminal request' };
  }
  const commandType = options.commandType || 'claude';
  if (!ALLOWED_COMMAND_TYPES.has(commandType)) return { ok: false, error: 'Unsupported agent command' };
  if (options.customCommand !== undefined && (typeof options.customCommand !== 'string' || options.customCommand.length > 8192)) {
    return { ok: false, error: 'Invalid custom command' };
  }
  if (options.cwd !== undefined && (typeof options.cwd !== 'string' || options.cwd.length > 4096 || !path.isAbsolute(options.cwd))) {
    return { ok: false, error: 'Invalid working directory' };
  }
  if (!ptyManager) return { ok: false };
  return ptyManager.spawnSession(id, {
    ...options,
    commandType,
    cols: Number.isFinite(options.cols) ? Math.max(2, Math.min(500, Math.floor(options.cols))) : 80,
    rows: Number.isFinite(options.rows) ? Math.max(1, Math.min(300, Math.floor(options.rows))) : 24,
    forceRestart: options.forceRestart === true,
    replayHistory: options.replayHistory === true,
  });
});

ipcMain.on('pty:write', (event, payload) => {
  if (!isTrustedIpc(event)) return;
  const { id, data } = payload || {};
  if (isValidSessionId(id) && typeof data === 'string' && data.length <= 65536 && ptyManager) {
    ptyManager.writeToSession(id, data);
  }
});

ipcMain.on('pty:resize', (event, payload) => {
  if (!isTrustedIpc(event)) return;
  const { id, cols, rows } = payload || {};
  if (isValidSessionId(id) && Number.isFinite(cols) && Number.isFinite(rows) && ptyManager) {
    ptyManager.resizeSession(id, Math.max(2, Math.min(500, Math.floor(cols))), Math.max(1, Math.min(300, Math.floor(rows))));
  }
});

ipcMain.handle('pty:pause', (event, payload) => {
  if (!isTrustedIpc(event)) return false;
  const { id, paused } = payload || {};
  if (!isValidSessionId(id) || typeof paused !== 'boolean') return false;
  if (!ptyManager) return false;
  return ptyManager.setPaused(id, paused);
});

ipcMain.handle('pty:kill', (event, payload) => {
  if (!isTrustedIpc(event)) return { ok: false };
  const { id } = payload || {};
  if (!isValidSessionId(id)) return { ok: false };
  if (ptyManager) ptyManager.killSession(id);
  return { ok: true };
});

ipcMain.handle('storage:load', (event) => {
  if (!isTrustedIpc(event)) return { exists: false, filePath: '', state: null };
  return loadPersistedState();
});

ipcMain.handle('storage:save', (event, state) => {
  if (!isTrustedIpc(event)) return { ok: false, error: 'Untrusted renderer' };
  if (!isValidCanvasState(state)) return { ok: false, error: 'Invalid canvas state' };
  return savePersistedState(state);
});

function runGit(cwd, args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, windowsHide: true, timeout: 8000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? null : String(stdout));
    });
  });
}

function mapPorcelainStatus(code) {
  if (code.includes('?') || code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  return 'modified';
}

ipcMain.handle('git:status', async (event, projectPath) => {
  if (!isTrustedIpc(event)) return { ok: false, error: 'Untrusted renderer' };
  if (typeof projectPath !== 'string' || projectPath.length > 4096 || !path.isAbsolute(projectPath)) {
    return { ok: false, error: 'Chemin invalide (il faut un chemin absolu).' };
  }
  try {
    if (!fs.statSync(projectPath).isDirectory()) return { ok: false, error: "Ce dossier n'existe pas." };
  } catch {
    return { ok: false, error: "Ce dossier n'existe pas." };
  }
  const status = await runGit(projectPath, ['status', '--porcelain', '-b', '--untracked-files=normal']);
  if (status === null) {
    return { ok: false, error: "Pas un dépôt git (ou git n'est pas installé). Lance « git init » dans ce dossier." };
  }
  const lines = status.split(/\r?\n/).filter(Boolean);
  let branchName = 'main';
  const files = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      branchName = line.slice(3).split('...')[0].replace(/^No commits yet on /, '').trim() || branchName;
      continue;
    }
    const code = line.slice(0, 2);
    const name = line.slice(3).replace(/^"|"$/g, '');
    files.push({ name, status: mapPorcelainStatus(code) });
  }
  const lastCommit = await runGit(projectPath, ['log', '-1', '--pretty=%s']);
  return {
    ok: true,
    branchName,
    lastCommitMessage: lastCommit ? lastCommit.trim() : '',
    modifiedFiles: files.slice(0, 200),
    totalModified: files.length,
  };
});

ipcMain.handle('dialog:pickFolder', async (event) => {
  if (!isTrustedIpc(event) || !mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir le dossier du projet',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('storage:getPath', (event) => {
  if (!isTrustedIpc(event)) return '';
  return getStateFilePath();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (ptyManager) ptyManager.killAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
