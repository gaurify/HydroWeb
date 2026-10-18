const { contextBridge, ipcRenderer } = require('electron');

function expose(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const wrapped = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('hydroweb', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getHistory: (limit) => ipcRenderer.invoke('get-history', limit),
  recordWater: (amountMl) => ipcRenderer.invoke('record-water', amountMl),
  recordGlass: () => ipcRenderer.invoke('record-water', 250),
  getReminderStatus: () => ipcRenderer.invoke('get-reminder-status'),
  pauseReminders: () => ipcRenderer.invoke('pause-reminders'),
  resumeReminders: () => ipcRenderer.invoke('resume-reminders'),
  showOverlay: () => ipcRenderer.invoke('show-overlay'),
  dismissOverlay: () => ipcRenderer.invoke('dismiss-overlay'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onStatsUpdated: (callback) => expose('stats-updated', callback),
  onReminderStatusChanged: (callback) => expose('reminder-status-changed', callback),
  onOverlayShow: (callback) => expose('overlay-data', callback)
});
