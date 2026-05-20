const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),
  addShortcut: (filePath) => ipcRenderer.invoke('add-shortcut', filePath),
  deleteShortcut: (id) => ipcRenderer.invoke('delete-shortcut', id),
  launchShortcut: (path) => ipcRenderer.invoke('launch-shortcut', path),
  updateFloatingPosition: (pos) => ipcRenderer.invoke('update-floating-position', pos),
  getFloatingPosition: () => ipcRenderer.invoke('get-floating-position'),
  showSettingsWindow: () => ipcRenderer.invoke('show-settings-window'),
  toggleFloatingWindow: () => ipcRenderer.invoke('toggle-floating-window'),
  extractIcon: (filePath) => ipcRenderer.invoke('extract-icon', filePath),
  setFloatingSize: (size) => ipcRenderer.invoke('set-floating-size', size),
  setFloatingBounds: (bounds) => ipcRenderer.invoke('set-floating-bounds', bounds),
  setFloatingIgnoreMouse: (ignore) => ipcRenderer.invoke('set-floating-ignore-mouse', ignore),

  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),

  onShortcutsUpdated: (callback) => {
    ipcRenderer.on('shortcuts-updated', (event, data) => callback(data));
  },
  onAppSettingsUpdated: (callback) => {
    ipcRenderer.on('app-settings-updated', (event, data) => callback(data));
  }
});
