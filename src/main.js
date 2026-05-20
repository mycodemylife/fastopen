const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const SHORTCUTS_FILE = path.join(app.getPath('userData'), 'shortcuts.json');
const POSITION_FILE = path.join(app.getPath('userData'), 'position.json');
const APP_SETTINGS_FILE = path.join(app.getPath('userData'), 'app-settings.json');

const DEFAULT_APP_SETTINGS = {
  ballStyle: 'default',
  ballImage: null,
  clockFaceColor: '#1e78dc',
  clockHandColor: '#ffffff',
  clockSecondHandColor: '#ff4444',
  clockTickColor: 'rgba(255,255,255,0.6)',
  ringLineColor: 'rgba(30, 120, 220, 0.18)',
  ringLineWidth: 1,
  ringLineStyle: 'solid'
};

let floatingWindow = null;
let settingsWindow = null;
let tray = null;
let floatingVisible = true;

function loadShortcuts() {
  try {
    if (fs.existsSync(SHORTCUTS_FILE)) {
      const data = fs.readFileSync(SHORTCUTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取快捷方式配置失败:', e);
  }
  return [];
}

function saveShortcuts(shortcuts) {
  try {
    fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存快捷方式配置失败:', e);
  }
}

function loadPosition() {
  try {
    if (fs.existsSync(POSITION_FILE)) {
      const data = fs.readFileSync(POSITION_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取位置配置失败:', e);
  }
  return null;
}

function savePosition(pos) {
  try {
    fs.writeFileSync(POSITION_FILE, JSON.stringify(pos), 'utf-8');
  } catch (e) {
    console.error('保存位置配置失败:', e);
  }
}

function loadAppSettings() {
  try {
    if (fs.existsSync(APP_SETTINGS_FILE)) {
      const data = fs.readFileSync(APP_SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('读取应用设置失败:', e);
  }
  return { ...DEFAULT_APP_SETTINGS };
}

function saveAppSettings(settings) {
  try {
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存应用设置失败:', e);
  }
}

function extractIconViaPowerShell(exePath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'extract-icon.ps1');
    const child = exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -ExePath "${exePath.replace(/"/g, '\\"')}"`, {
      timeout: 8000,
      maxBuffer: 1024 * 1024 * 2
    }, (err, stdout, stderr) => {
      if (err || !stdout || !stdout.trim()) {
        resolve(null);
        return;
      }
      const base64 = stdout.trim();
      if (base64.length < 10) {
        resolve(null);
        return;
      }
      resolve('data:image/png;base64,' + base64);
    });
  });
}

async function extractIcon(exePath) {
  try {
    if (!fs.existsSync(exePath)) return null;
    const ext = path.extname(exePath).toLowerCase();
    if (ext !== '.exe' && ext !== '.lnk') return null;

    if (ext === '.lnk') {
      try {
        const linkInfo = shell.readShortcutLink(exePath);
        if (linkInfo && linkInfo.target) {
          const targetIcon = await extractIconViaPowerShell(linkInfo.target);
          if (targetIcon) return targetIcon;
        }
      } catch (e) {}
    }

    const icon = await extractIconViaPowerShell(exePath);
    if (icon) return icon;

    try {
      const nativeIcon = await app.getFileIcon(exePath, { size: 'large' });
      const dataUrl = nativeIcon.toDataURL();
      if (dataUrl && dataUrl.length > 100 && !dataUrl.endsWith(',')) {
        return dataUrl;
      }
    } catch (e) {}

    return null;
  } catch (e) {
    console.error('提取图标失败:', e);
    return null;
  }
}

function createFloatingWindow() {
  const savedPos = loadPosition();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let x, y;
  if (savedPos) {
    x = savedPos.x;
    y = savedPos.y;
  } else {
    x = screenWidth - 80;
    y = Math.floor(screenHeight / 2 - 28);
  }

  const initialW = 96;
  const initialH = 96;

  floatingWindow = new BrowserWindow({
    width: initialW,
    height: initialH,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  floatingWindow.setAlwaysOnTop(true, 'floating');
  floatingWindow.setVisibleOnAllWorkspaces(true);
  floatingWindow.setIgnoreMouseEvents(true, { forward: true });

  floatingWindow.loadFile(path.join(__dirname, 'floating', 'floating.html'));

  floatingWindow.on('move', () => {
    if (floatingWindow) {
      const pos = floatingWindow.getPosition();
      savePosition({ x: pos[0], y: pos[1] });
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 700,
    height: 550,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    title: 'FastOpen - 快捷方式配置',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings', 'settings.html'));
  settingsWindow.setMenu(null);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('shortcuts-updated', loadShortcuts());
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('FastOpen - 快捷启动');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开配置',
      click: () => createSettingsWindow()
    },
    {
      label: floatingVisible ? '隐藏悬浮球' : '显示悬浮球',
      click: () => {
        floatingVisible = !floatingVisible;
        if (floatingWindow && !floatingWindow.isDestroyed()) {
          if (floatingVisible) {
            floatingWindow.show();
          } else {
            floatingWindow.hide();
          }
        }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    createSettingsWindow();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开配置',
      click: () => createSettingsWindow()
    },
    {
      label: floatingVisible ? '隐藏悬浮球' : '显示悬浮球',
      click: () => {
        floatingVisible = !floatingVisible;
        if (floatingWindow && !floatingWindow.isDestroyed()) {
          if (floatingVisible) {
            floatingWindow.show();
          } else {
            floatingWindow.hide();
          }
        }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function setupIPC() {
  ipcMain.handle('get-shortcuts', () => {
    return loadShortcuts();
  });

  ipcMain.handle('save-shortcuts', (event, shortcuts) => {
    saveShortcuts(shortcuts);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('shortcuts-updated', shortcuts);
    }
    return true;
  });

  ipcMain.handle('add-shortcut', async (event, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.exe' && ext !== '.lnk') {
      return { error: '仅支持 .exe 和 .lnk 文件' };
    }

    if (!fs.existsSync(filePath)) {
      return { error: '文件不存在' };
    }

    const name = path.basename(filePath, ext);
    const iconDataUrl = await extractIcon(filePath);

    const shortcut = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: name,
      path: filePath,
      icon: iconDataUrl
    };

    const shortcuts = loadShortcuts();
    shortcuts.push(shortcut);
    saveShortcuts(shortcuts);

    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('shortcuts-updated', shortcuts);
    }

    return shortcut;
  });

  ipcMain.handle('delete-shortcut', (event, id) => {
    let shortcuts = loadShortcuts();
    shortcuts = shortcuts.filter(s => s.id !== id);
    saveShortcuts(shortcuts);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('shortcuts-updated', shortcuts);
    }
    return true;
  });

  ipcMain.handle('launch-shortcut', (event, shortcutPath) => {
    if (!fs.existsSync(shortcutPath)) {
      return { error: '文件不存在: ' + shortcutPath };
    }
    try {
      shell.openPath(shortcutPath);
      return { success: true };
    } catch (e) {
      return { error: '启动失败: ' + e.message };
    }
  });

  ipcMain.handle('update-floating-position', (event, pos) => {
    savePosition(pos);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.setPosition(Math.round(pos.x), Math.round(pos.y));
    }
    return true;
  });

  ipcMain.handle('get-floating-position', () => {
    return loadPosition();
  });

  ipcMain.handle('show-settings-window', () => {
    createSettingsWindow();
    return true;
  });

  ipcMain.handle('toggle-floating-window', () => {
    floatingVisible = !floatingVisible;
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      if (floatingVisible) {
        floatingWindow.show();
      } else {
        floatingWindow.hide();
      }
    }
    updateTrayMenu();
    return floatingVisible;
  });

  ipcMain.handle('extract-icon', async (event, filePath) => {
    return await extractIcon(filePath);
  });

  ipcMain.handle('set-floating-size', (event, size) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.setSize(size.width, size.height);
    }
    return true;
  });

  ipcMain.handle('set-floating-bounds', (event, bounds) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.setBounds(bounds);
    }
    return true;
  });

  ipcMain.handle('set-floating-ignore-mouse', (event, ignore) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
    return true;
  });

  ipcMain.handle('get-app-settings', () => {
    return loadAppSettings();
  });

  ipcMain.handle('save-app-settings', (event, settings) => {
    const merged = { ...DEFAULT_APP_SETTINGS, ...settings };
    saveAppSettings(merged);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('app-settings-updated', merged);
    }
    return merged;
  });

  ipcMain.handle('select-image-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(settingsWindow || floatingWindow, {
      title: '选择图片',
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      const mime = mimeMap[ext] || 'image/png';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (e) {
      return null;
    }
  });
}

app.whenReady().then(() => {
  setupIPC();
  createFloatingWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('activate', () => {
  if (floatingWindow === null) {
    createFloatingWindow();
  }
});
