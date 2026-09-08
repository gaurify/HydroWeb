// Storage wrapper — supports Electron IPC, Appwrite Backend, & LocalStorage
window.Storage = {
  _getWebStore(key, defaultValue) {
    try {
      const data = localStorage.getItem('hydroweb_' + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch(e) {
      return defaultValue;
    }
  },
  _setWebStore(key, value) {
    try {
      localStorage.setItem('hydroweb_' + key, JSON.stringify(value));
    } catch(e){}
  },

  async getSettings() {
    if (window.hydroweb && window.hydroweb.getSettings) {
      try { return await window.hydroweb.getSettings(); } catch(e){}
    }
    return this._getWebStore('settings', {
      intervalMinutes: 30,
      activeHoursStart: '08:00',
      activeHoursEnd: '22:00',
      soundEnabled: true,
      dailyGoal: 8,
      startOnBoot: false,
      overlayEnabled: true
    });
  },

  async saveSettings(settings) {
    if (window.AppwriteBackend) {
      window.AppwriteBackend.saveSettings(settings).catch(() => {});
    }
    if (window.hydroweb && window.hydroweb.saveSettings) {
      try { return await window.hydroweb.saveSettings(settings); } catch(e){}
    }
    this._setWebStore('settings', settings);
    return true;
  },

  async getStats() {
    if (window.hydroweb && window.hydroweb.getStats) {
      try { return await window.hydroweb.getStats(); } catch(e){}
    }
    const today = new Date().toISOString().split('T')[0];
    const stats = this._getWebStore('stats_' + today, { glasses: 0, reminders: 0 });
    const settings = await this.getSettings();
    return { ...stats, goal: settings.dailyGoal, streak: 1, volumeMl: stats.glasses * 250, goalVolumeMl: settings.dailyGoal * 250 };
  },

  async recordGlass() {
    let resultStats;
    if (window.hydroweb && window.hydroweb.recordGlass) {
      try { resultStats = await window.hydroweb.recordGlass(); } catch(e){}
    }
    if (!resultStats) {
      const today = new Date().toISOString().split('T')[0];
      const stats = this._getWebStore('stats_' + today, { glasses: 0, reminders: 0 });
      stats.glasses += 1;
      this._setWebStore('stats_' + today, stats);
      resultStats = await this.getStats();
    }
    if (window.AppwriteBackend) {
      window.AppwriteBackend.recordGlass(resultStats).catch(() => {});
    }
    return resultStats;
  },

  async getReminderStatus() {
    if (window.hydroweb && window.hydroweb.getReminderStatus) {
      try { return await window.hydroweb.getReminderStatus(); } catch(e){}
    }
    return this._getWebStore('status', { isPaused: false, nextReminderTime: null, intervalMinutes: 30 });
  }
};

// Polyfill window.hydroweb if running in web browser
if (!window.hydroweb) {
  window.hydroweb = {
    onStatsUpdated: () => {},
    onReminderStatusChanged: () => {},
    onOverlayShow: () => {},
    showOverlay: async () => {
      alert("Spider-Man says: Time to drink water! 💧");
    },
    dismissOverlay: async () => {},
    pauseReminders: async () => ({ isPaused: true, nextReminderTime: null, intervalMinutes: 30 }),
    resumeReminders: async () => ({ isPaused: false, nextReminderTime: null, intervalMinutes: 30 }),
    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {}
  };
}
