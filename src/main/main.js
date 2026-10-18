const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const ReminderScheduler = require('./reminderScheduler');
const { showOverlay, hideOverlay } = require('./notifications');

let store = null;
let mainWindow = null;
let overlayWindow = null;
let tray = null;
let scheduler = null;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultSettings() {
  return {
    intervalMinutes: 30,
    activeHoursStart: '08:00',
    activeHoursEnd: '22:00',
    soundEnabled: true,
    dailyGoalMl: 2000,
    startOnBoot: false,
    overlayEnabled: true,
    volumeUnit: 'ml'
  };
}

function sanitizeSettings(input = {}) {
  const defaults = defaultSettings();
  const merged = { ...defaults, ...input };

  const intervalMinutes = Number(merged.intervalMinutes);
  merged.intervalMinutes = Number.isFinite(intervalMinutes) ? Math.min(240, Math.max(5, Math.floor(intervalMinutes))) : defaults.intervalMinutes;

  merged.activeHoursStart = /^\d{2}:\d{2}$/.test(String(merged.activeHoursStart)) ? String(merged.activeHoursStart) : defaults.activeHoursStart;
  merged.activeHoursEnd = /^\d{2}:\d{2}$/.test(String(merged.activeHoursEnd)) ? String(merged.activeHoursEnd) : defaults.activeHoursEnd;

  const legacyGoal = Number(merged.dailyGoal);
  const goalMl = Number(merged.dailyGoalMl);
  if (!Number.isFinite(goalMl) || goalMl <= 0) {
    if (Number.isFinite(legacyGoal) && legacyGoal > 0) {
      merged.dailyGoalMl = Math.floor(legacyGoal * 250);
    } else {
      merged.dailyGoalMl = defaults.dailyGoalMl;
    }
  } else {
    merged.dailyGoalMl = Math.min(10000, Math.max(250, Math.floor(goalMl)));
  }

  merged.soundEnabled = merged.soundEnabled !== false;
  merged.startOnBoot = Boolean(merged.startOnBoot);
  merged.overlayEnabled = merged.overlayEnabled !== false;
  merged.volumeUnit = merged.volumeUnit === 'oz' ? 'oz' : 'ml';

  delete merged.dailyGoal;
  return merged;
}

function getSettings() {
  const saved = store.get('settings', defaultSettings());
  const sanitized = sanitizeSettings(saved);
  store.set('settings', sanitized);
  return sanitized;
}

function getAllDailyData() {
  return store.get('dailyData', {});
}

function writeAllDailyData(data) {
  store.set('dailyData', data);
}

function getDailyRecord(dateKey) {
  const all = getAllDailyData();
  if (all[dateKey]) {
    return all[dateKey];
  }

  const legacy = store.get(`stats.${dateKey}`, { glasses: 0, reminders: 0 });
  const totalMl = Math.max(0, Number(legacy.glasses || 0) * 250);
  const migrated = {
    totalMl,
    reminders: Math.max(0, Number(legacy.reminders || 0)),
    entries: legacy.glasses > 0
      ? Array.from({ length: legacy.glasses }, () => ({ amountMl: 250, timestamp: new Date().toISOString() }))
      : []
  };

  all[dateKey] = migrated;
  writeAllDailyData(all);
  return migrated;
}

function setDailyRecord(dateKey, value) {
  const all = getAllDailyData();
  all[dateKey] = value;
  writeAllDailyData(all);
}

function getStreak(goalMl) {
  let streak = 0;
  const day = new Date();

  for (let i = 0; i < 366; i += 1) {
    const key = localDateKey(day);
    const record = getDailyRecord(key);
    if ((record.totalMl || 0) >= goalMl) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
    day.setDate(day.getDate() - 1);
  }

  return streak;
}

function getHistory(limit = 14) {
  const output = [];
  const day = new Date();

  for (let i = 0; i < limit; i += 1) {
    const key = localDateKey(day);
    const record = getDailyRecord(key);
    output.push({
      date: key,
      totalMl: Number(record.totalMl || 0),
      reminders: Number(record.reminders || 0),
      entriesCount: Array.isArray(record.entries) ? record.entries.length : 0
    });
    day.setDate(day.getDate() - 1);
  }

  return output;
}

function getTodayStats() {
  const settings = getSettings();
  const key = localDateKey();
  const record = getDailyRecord(key);
  const goalVolumeMl = settings.dailyGoalMl;
  const volumeMl = Number(record.totalMl || 0);
  const percentage = goalVolumeMl > 0 ? Math.min(100, Math.round((volumeMl / goalVolumeMl) * 100)) : 0;

  return {
    date: key,
    volumeMl,
    goalVolumeMl,
    reminders: Number(record.reminders || 0),
    entries: Array.isArray(record.entries) ? record.entries : [],
    streak: getStreak(goalVolumeMl),
    progressPercent: percentage,
    history: getHistory(14)
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    frame: false,
    resizable: true,
    minWidth: 360,
    minHeight: 620,
    transparent: false,
    backgroundColor: '#080A0D',
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
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
    const status = scheduler ? scheduler.getStatus() : { isPaused: true };
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show HydroWeb',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      { type: 'separator' },
      {
        label: status.isPaused ? 'Resume Reminders' : 'Pause Reminders',
        click: () => {
          if (!scheduler) return;
          if (status.isPaused) scheduler.resume();
          else scheduler.pause();
          updateTrayMenu();
          mainWindow.webContents.send('reminder-status-changed', scheduler.getStatus());
        }
      },
      { label: 'Test Reminder', click: () => triggerReminder() },
      { type: 'separator' },
      {
        label: 'Quit HydroWeb',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateTrayMenu();
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return updateTrayMenu;
}

function bumpReminderCount() {
  const today = localDateKey();
  const record = getDailyRecord(today);
  const next = {
    ...record,
    reminders: Number(record.reminders || 0) + 1
  };
  setDailyRecord(today, next);
}

function triggerReminder() {
  bumpReminderCount();
  const settings = getSettings();
  showOverlay(overlayWindow, mainWindow, settings);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stats-updated', getTodayStats());
  }
}

function setupIPC(updateTrayMenu) {
  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('save-settings', (_, newSettings) => {
    const sanitized = sanitizeSettings(newSettings);
    store.set('settings', sanitized);

    if (scheduler) {
      scheduler.updateSettings(sanitized);
    }

    app.setLoginItemSettings({ openAtLogin: sanitized.startOnBoot });
    return sanitized;
  });

  ipcMain.handle('get-stats', () => getTodayStats());
  ipcMain.handle('get-history', (_, limit) => getHistory(Number(limit) || 14));

  ipcMain.handle('record-water', (_, amountMl) => {
    const amount = Math.min(2000, Math.max(1, Math.floor(Number(amountMl) || 0)));
    if (!amount) {
      throw new Error('Invalid amount.');
    }

    const today = localDateKey();
    const record = getDailyRecord(today);
    const entries = Array.isArray(record.entries) ? [...record.entries] : [];
    entries.push({ amountMl: amount, timestamp: new Date().toISOString() });

    const next = {
      ...record,
      totalMl: Number(record.totalMl || 0) + amount,
      entries
    };

    setDailyRecord(today, next);
    const stats = getTodayStats();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stats-updated', stats);
    }

    return stats;
  });

  ipcMain.handle('record-glass', () => {
    const today = localDateKey();
    const record = getDailyRecord(today);
    const entries = Array.isArray(record.entries) ? [...record.entries] : [];
    entries.push({ amountMl: 250, timestamp: new Date().toISOString() });

    const next = {
      ...record,
      totalMl: Number(record.totalMl || 0) + 250,
      entries
    };

    setDailyRecord(today, next);
    const stats = getTodayStats();

    if (mainWindow && !mainWindow.isDestroyed()) {
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

  ipcMain.handle('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  });

  ipcMain.handle('get-reminder-status', () => {
    return scheduler ? scheduler.getStatus() : { isPaused: true, nextReminderTime: null, intervalMinutes: 30 };
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  const { default: Store } = await import('electron-store');
  store = new Store({
    defaults: {
      settings: defaultSettings(),
      dailyData: {}
    }
  });

  createMainWindow();
  createOverlayWindow();
  const updateTrayMenu = createTray();
  setupIPC(updateTrayMenu);

  scheduler = new ReminderScheduler(
    getSettings(),
    () => triggerReminder(),
    (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reminder-status-changed', status);
      }
      updateTrayMenu();
    }
  );

  scheduler.start();
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows.
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});
