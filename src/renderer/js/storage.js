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

window.Storage = {
  _statsListeners: [],
  _reminderListeners: [],
  _webReminderTimer: null,

  _getWebStore(key, defaultValue) {
    try {
      const data = localStorage.getItem(`hydroweb_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  _setWebStore(key, value) {
    try {
      localStorage.setItem(`hydroweb_${key}`, JSON.stringify(value));
    } catch (e) {}
  },

  _getAllDailyData() {
    return this._getWebStore('dailyData', {});
  },

  _setAllDailyData(data) {
    this._setWebStore('dailyData', data);
  },

  _getDayRecord(day) {
    const all = this._getAllDailyData();
    if (all[day]) return all[day];

    const legacy = this._getWebStore(`stats_${day}`, { glasses: 0, reminders: 0 });
    const migrated = {
      totalMl: Number(legacy.glasses || 0) * 250,
      reminders: Number(legacy.reminders || 0),
      entries: Number(legacy.glasses || 0) > 0
        ? Array.from({ length: Number(legacy.glasses || 0) }, () => ({ amountMl: 250, timestamp: new Date().toISOString() }))
        : []
    };
    all[day] = migrated;
    this._setAllDailyData(all);
    return migrated;
  },

  _setDayRecord(day, value) {
    const all = this._getAllDailyData();
    all[day] = value;
    this._setAllDailyData(all);
  },

  _sanitizeSettings(input = {}) {
    const defaults = defaultSettings();
    const merged = { ...defaults, ...input };

    const legacyGoal = Number(merged.dailyGoal);
    const goalMl = Number(merged.dailyGoalMl);
    merged.dailyGoalMl = Number.isFinite(goalMl) && goalMl > 0
      ? Math.min(10000, Math.max(250, Math.floor(goalMl)))
      : (Number.isFinite(legacyGoal) && legacyGoal > 0 ? legacyGoal * 250 : defaults.dailyGoalMl);

    merged.intervalMinutes = Number.isFinite(Number(merged.intervalMinutes))
      ? Math.min(240, Math.max(5, Math.floor(Number(merged.intervalMinutes))))
      : defaults.intervalMinutes;

    merged.soundEnabled = merged.soundEnabled !== false;
    merged.startOnBoot = Boolean(merged.startOnBoot);
    merged.overlayEnabled = merged.overlayEnabled !== false;
    merged.volumeUnit = merged.volumeUnit === 'oz' ? 'oz' : 'ml';

    delete merged.dailyGoal;
    return merged;
  },

  _parseClock(value, fallbackHour) {
    const match = typeof value === 'string' ? value.match(/^(\d{2}):(\d{2})$/) : null;
    if (!match) return { hour: fallbackHour, minute: 0 };
    return {
      hour: Math.min(23, Math.max(0, Number(match[1]))),
      minute: Math.min(59, Math.max(0, Number(match[2])))
    };
  },

  _computeNextWebReminder(settings) {
    const now = new Date();
    const next = new Date(now.getTime() + settings.intervalMinutes * 60 * 1000);

    const start = this._parseClock(settings.activeHoursStart, 8);
    const end = this._parseClock(settings.activeHoursEnd, 22);

    const startAt = new Date(next);
    startAt.setHours(start.hour, start.minute, 0, 0);
    const endAt = new Date(next);
    endAt.setHours(end.hour, end.minute, 0, 0);
    if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);

    if (next < startAt) return startAt.toISOString();
    if (next >= endAt) {
      const tomorrow = new Date(startAt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString();
    }
    return next.toISOString();
  },

  _scheduleWebReminder() {
    if (this._webReminderTimer) {
      clearTimeout(this._webReminderTimer);
      this._webReminderTimer = null;
    }
    if (window.hydroweb && window.hydroweb.getReminderStatus) return;

    const status = this._getWebStore('status', { isPaused: false, nextReminderTime: null, intervalMinutes: 30 });
    if (status.isPaused || !status.nextReminderTime) return;

    const delay = Math.max(500, new Date(status.nextReminderTime).getTime() - Date.now());
    this._webReminderTimer = setTimeout(async () => {
      await window.hydroweb.showOverlay();
      await this.resumeReminders();
    }, delay);
  },

  _emitStats(stats) {
    this._statsListeners.forEach((fn) => fn(stats));
  },

  _emitReminder(status) {
    this._reminderListeners.forEach((fn) => fn(status));
  },

  async getSettings() {
    if (window.hydroweb && window.hydroweb.getSettings) {
      try {
        return this._sanitizeSettings(await window.hydroweb.getSettings());
      } catch (e) {}
    }

    const settings = this._sanitizeSettings(this._getWebStore('settings', defaultSettings()));
    this._setWebStore('settings', settings);
    return settings;
  },

  async saveSettings(settings) {
    const sanitized = this._sanitizeSettings(settings);

    if (window.AppwriteBackend) {
      window.AppwriteBackend.saveSettings(sanitized).catch(() => {});
    }

    if (window.hydroweb && window.hydroweb.saveSettings) {
      try {
        return this._sanitizeSettings(await window.hydroweb.saveSettings(sanitized));
      } catch (e) {}
    }

    this._setWebStore('settings', sanitized);
    this._scheduleWebReminder();
    return sanitized;
  },

  async getStats() {
    if (window.hydroweb && window.hydroweb.getStats) {
      try {
        return await window.hydroweb.getStats();
      } catch (e) {}
    }

    const settings = await this.getSettings();
    const today = localDateKey();
    const todayRecord = this._getDayRecord(today);

    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 366; i += 1) {
      const key = localDateKey(cursor);
      const rec = this._getDayRecord(key);
      if ((rec.totalMl || 0) >= settings.dailyGoalMl) {
        streak += 1;
      } else if (i > 0) {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      date: today,
      volumeMl: Number(todayRecord.totalMl || 0),
      goalVolumeMl: settings.dailyGoalMl,
      reminders: Number(todayRecord.reminders || 0),
      entries: Array.isArray(todayRecord.entries) ? todayRecord.entries : [],
      streak,
      progressPercent: Math.min(100, Math.round(((todayRecord.totalMl || 0) / settings.dailyGoalMl) * 100)),
      history: await this.getHistory(14)
    };
  },

  async getHistory(limit = 14) {
    if (window.hydroweb && window.hydroweb.getHistory) {
      try {
        return await window.hydroweb.getHistory(limit);
      } catch (e) {}
    }

    const rows = [];
    const cursor = new Date();
    for (let i = 0; i < limit; i += 1) {
      const key = localDateKey(cursor);
      const rec = this._getDayRecord(key);
      rows.push({
        date: key,
        totalMl: Number(rec.totalMl || 0),
        reminders: Number(rec.reminders || 0),
        entriesCount: Array.isArray(rec.entries) ? rec.entries.length : 0
      });
      cursor.setDate(cursor.getDate() - 1);
    }

    return rows;
  },

  async recordWater(amountMl) {
    const amount = Math.min(2000, Math.max(1, Math.floor(Number(amountMl) || 0)));
    if (!amount) {
      throw new Error('Please enter a valid amount.');
    }

    let resultStats;
    if (window.hydroweb && window.hydroweb.recordWater) {
      try {
        resultStats = await window.hydroweb.recordWater(amount);
      } catch (e) {}
    }

    if (!resultStats) {
      const today = localDateKey();
      const rec = this._getDayRecord(today);
      const entries = Array.isArray(rec.entries) ? [...rec.entries] : [];
      entries.push({ amountMl: amount, timestamp: new Date().toISOString() });
      this._setDayRecord(today, {
        ...rec,
        totalMl: Number(rec.totalMl || 0) + amount,
        entries
      });
      resultStats = await this.getStats();
    }

    if (window.AppwriteBackend) {
      window.AppwriteBackend.recordDay(resultStats).catch(() => {});
    }

    this._emitStats(resultStats);
    return resultStats;
  },

  async incrementReminderCount() {
    const today = localDateKey();
    const rec = this._getDayRecord(today);
    this._setDayRecord(today, {
      ...rec,
      reminders: Number(rec.reminders || 0) + 1
    });
    this._emitStats(await this.getStats());
  },

  async getReminderStatus() {
    if (window.hydroweb && window.hydroweb.getReminderStatus) {
      try {
        const status = await window.hydroweb.getReminderStatus();
        this._emitReminder(status);
        return status;
      } catch (e) {}
    }

    return this._getWebStore('status', {
      isPaused: false,
      nextReminderTime: null,
      intervalMinutes: 30
    });
  },

  async pauseReminders() {
    if (window.hydroweb && window.hydroweb.pauseReminders) {
      const status = await window.hydroweb.pauseReminders();
      this._emitReminder(status);
      return status;
    }

    const status = { isPaused: true, nextReminderTime: null, intervalMinutes: 30 };
    this._setWebStore('status', status);
    this._emitReminder(status);
    this._scheduleWebReminder();
    return status;
  },

  async resumeReminders() {
    if (window.hydroweb && window.hydroweb.resumeReminders) {
      const status = await window.hydroweb.resumeReminders();
      this._emitReminder(status);
      return status;
    }

    const settings = await this.getSettings();
    const next = this._computeNextWebReminder(settings);
    const status = { isPaused: false, nextReminderTime: next, intervalMinutes: settings.intervalMinutes };
    this._setWebStore('status', status);
    this._emitReminder(status);
    this._scheduleWebReminder();
    return status;
  },

  onStatsUpdated(callback) {
    if (typeof callback === 'function') this._statsListeners.push(callback);
    return () => {
      this._statsListeners = this._statsListeners.filter((cb) => cb !== callback);
    };
  },

  onReminderStatusChanged(callback) {
    if (typeof callback === 'function') this._reminderListeners.push(callback);
    return () => {
      this._reminderListeners = this._reminderListeners.filter((cb) => cb !== callback);
    };
  }
};

if (!window.hydroweb) {
  const noop = () => {};
  window.hydroweb = {
    onStatsUpdated: noop,
    onReminderStatusChanged: noop,
    onOverlayShow: noop,
    async showOverlay() {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('HydroWeb Reminder', { body: 'Time to drink water 💧' });
        } else {
          alert('HydroWeb reminder: Time to drink water 💧');
        }
      } else {
        alert('HydroWeb reminder: Time to drink water 💧');
      }
      await window.Storage.incrementReminderCount();
    },
    async dismissOverlay() {},
    async pauseReminders() {
      return window.Storage.pauseReminders();
    },
    async resumeReminders() {
      return window.Storage.resumeReminders();
    },
    minimizeWindow: noop,
    maximizeWindow: noop,
    closeWindow: noop
  };
}

if (window.hydroweb.onStatsUpdated) {
  window.hydroweb.onStatsUpdated((stats) => window.Storage._emitStats(stats));
}
if (window.hydroweb.onReminderStatusChanged) {
  window.hydroweb.onReminderStatusChanged((status) => window.Storage._emitReminder(status));
}

window.Storage._scheduleWebReminder();
