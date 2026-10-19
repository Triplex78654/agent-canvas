const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentCanvasAPI', {
  platform: process.platform,
  spawnPty: (id, options) => ipcRenderer.invoke('pty:spawn', { id, options }),
  writePty: (id, data) => ipcRenderer.send('pty:write', { id, data }),
  resizePty: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  pausePty: (id, paused) => ipcRenderer.invoke('pty:pause', { id, paused }),
  killPty: (id) => ipcRenderer.invoke('pty:kill', { id }),

  loadCanvasState: () => ipcRenderer.invoke('storage:load'),
  saveCanvasState: (state) => ipcRenderer.invoke('storage:save', state),
  getStoragePath: () => ipcRenderer.invoke('storage:getPath'),
  getGitStatus: (projectPath) => ipcRenderer.invoke('git:status', projectPath),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  detectClis: () => ipcRenderer.invoke('cli:detect'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onAppUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update', listener);
    return () => ipcRenderer.removeListener('app:update', listener);
  },

  onPtyData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pty:data', listener);
    return () => ipcRenderer.removeListener('pty:data', listener);
  },
  onPtyStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pty:status', listener);
    return () => ipcRenderer.removeListener('pty:status', listener);
  },
  onPtyPrompt: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pty:prompt', listener);
    return () => ipcRenderer.removeListener('pty:prompt', listener);
  },
  onPtyExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pty:exit', listener);
    return () => ipcRenderer.removeListener('pty:exit', listener);
  },
});
