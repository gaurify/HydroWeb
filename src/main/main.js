const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, Notification } = require('electron');
const path = require('path');
const ReminderScheduler = require('./reminderScheduler');
const { showOverlay, hideOverlay } = require('./notifications');

let store = null;
let mainWindow = null;
let overlayWindow = null;
let tray = null;
let scheduler = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'renderer', 'js', 'preload.js')
    },
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'renderer', 'js', 'preload.js')
    },
    show: false
  });
  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(false);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('HydroWeb — Hydration Reminder');
  
  const updateTrayMenu = () => {
    const isPaused = scheduler ? scheduler.isPaused : false;
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show HydroWeb', click: () => { mainWindow.show(); mainWindow.focus(); } },
      { type: 'separator' },
      { label: isPaused ? 'Resume Reminders' : 'Pause Reminders', click: () => {
        if (isPaused) scheduler.resume(); else scheduler.pause();
        updateTrayMenu();
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('reminder-status-changed', scheduler.getStatus());
        }
      }},
      { label: 'Test Reminder', click: () => triggerReminder() },
      { type: 'separator' },
      { label: 'Quit HydroWeb', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
  };
  
  updateTrayMenu();
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
  
  return updateTrayMenu;
}

function triggerReminder() {
  const today = new Date().toISOString().split('T')[0];
  const statsKey = `stats.${today}`;
  const currentStats = store.get(statsKey, { glasses: 0, reminders: 0 });
  store.set(statsKey, { ...currentStats, reminders: currentStats.reminders + 1 });
  
  const settings = store.get('settings');
  showOverlay(overlayWindow, mainWindow, settings);
}

function getTodayStats() {
  const today = new Date().toISOString().split('T')[0];
  const stats = store.get(`stats.${today}`, { glasses: 0, reminders: 0 });
  const settings = store.get('settings');
  
  let streak = 0;
  let checkDate = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayStats = store.get(`stats.${dateStr}`, { glasses: 0 });
    if (dayStats.glasses >= settings.dailyGoal) {
      streak++;
    } else if (i > 0) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  const volumeMl = stats.glasses * 250;
  const goalVolumeMl = settings.dailyGoal * 250;
  
  return { ...stats, goal: settings.dailyGoal, streak, volumeMl, goalVolumeMl };
}

function setupIPC(updateTrayMenu) {
  ipcMain.handle('get-settings', () => store.get('settings'));
  
  ipcMain.handle('save-settings', (_, newSettings) => {
    store.set('settings', newSettings);
    if (scheduler) scheduler.updateSettings(newSettings);
    if (newSettings.startOnBoot !== undefined) {
      app.setLoginItemSettings({ openAtLogin: newSettings.startOnBoot });
    }
    return true;
  });
  
  ipcMain.handle('get-stats', () => getTodayStats());
  
  ipcMain.handle('record-glass', () => {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `stats.${today}`;
    const currentStats = store.get(statsKey, { glasses: 0, reminders: 0 });
    store.set(statsKey, { ...currentStats, glasses: currentStats.glasses + 1 });
    const stats = getTodayStats();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('stats-updated', stats);
    }
    return stats;
  });
  
  ipcMain.handle('pause-reminders', () => {
    if (scheduler) scheduler.pause();
    updateTrayMenu();
    return scheduler ? scheduler.getStatus() : { isPaused: true, nextReminderTime: null, intervalMinutes: 30 };
  });
  
  ipcMain.handle('resume-reminders', () => {
    if (scheduler) scheduler.resume();
    updateTrayMenu();
    return scheduler ? scheduler.getStatus() : { isPaused: false, nextReminderTime: null, intervalMinutes: 30 };
  });
  
  ipcMain.handle('dismiss-overlay', () => {
    hideOverlay(overlayWindow);
    return true;
  });
  
  ipcMain.handle('show-overlay', () => {
    triggerReminder();
    return true;
  });
  
  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.hide(); });
  ipcMain.handle('get-reminder-status', () => {
    return scheduler ? scheduler.getStatus() : { isPaused: true, nextReminderTime: null, intervalMinutes: 30 };
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  const { default: Store } = await import('electron-store');
  store = new Store({
    defaults: {
      settings: {
        intervalMinutes: 30,
        activeHoursStart: '08:00',
        activeHoursEnd: '22:00',
        soundEnabled: true,
        dailyGoal: 8,
        startOnBoot: false,
        overlayEnabled: true
      }
    }
  });

  createMainWindow();
  createOverlayWindow();
  const updateTrayMenu = createTray();
  setupIPC(updateTrayMenu);
  
  const settings = store.get('settings');
  scheduler = new ReminderScheduler(settings, () => triggerReminder());
  scheduler.start();
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray on Windows
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});
