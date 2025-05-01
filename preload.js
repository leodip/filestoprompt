const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  reloadFile: (path) => ipcRenderer.invoke('reloadFile', path),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  searchFiles: (baseFolder, extensions, excludeFolders) => 
    ipcRenderer.invoke('search-files', baseFolder, extensions, excludeFolders),
  calculateTokens: (text) => ipcRenderer.invoke('calculate-tokens', text),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});