class ReminderScheduler {
  constructor(settings, onReminder, onStatusChange) {
    this.settings = settings || {};
    this.onReminder = typeof onReminder === 'function' ? onReminder : () => {};
    this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : () => {};

    this.timer = null;
    this.isPaused = false;
    this.nextReminderTime = null;
  }

  start() {
    this.isPaused = false;
    this._scheduleNext();
    this._emitStatus();
  }

  stop() {
    this._clearTimer();
    this.nextReminderTime = null;
    this._emitStatus();
  }

  pause() {
    this.isPaused = true;
    this._clearTimer();
    this.nextReminderTime = null;
    this._emitStatus();
  }

  resume() {
    this.isPaused = false;
    this._scheduleNext();
    this._emitStatus();
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.isPaused) {
      this._scheduleNext();
    }
    this._emitStatus();
  }

  getStatus() {
    return {
      isPaused: this.isPaused,
      nextReminderTime: this.nextReminderTime,
      intervalMinutes: this._getIntervalMinutes()
    };
  }

  _emitStatus() {
    this.onStatusChange(this.getStatus());
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _getIntervalMinutes() {
    const interval = Number(this.settings.intervalMinutes);
    if (!Number.isFinite(interval) || interval < 1) return 30;
    return Math.min(24 * 60, Math.max(1, Math.floor(interval)));
  }

  _parseTime(value, fallbackHour) {
    if (typeof value !== 'string') {
      return { hour: fallbackHour, minute: 0 };
    }
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return { hour: fallbackHour, minute: 0 };
    }
    const hour = Math.min(23, Math.max(0, Number(match[1])));
    const minute = Math.min(59, Math.max(0, Number(match[2])));
    return { hour, minute };
  }

  _activeWindowFor(date) {
    const startTime = this._parseTime(this.settings.activeHoursStart, 8);
    const endTime = this._parseTime(this.settings.activeHoursEnd, 22);

    const start = new Date(date);
    start.setHours(startTime.hour, startTime.minute, 0, 0);

    const end = new Date(date);
    end.setHours(endTime.hour, endTime.minute, 0, 0);

    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  }

  _nextActiveStart(date) {
    const { start, end } = this._activeWindowFor(date);
    if (date < start) {
      return start;
    }
    if (date >= start && date < end) {
      return date;
    }

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextWindow = this._activeWindowFor(nextDay);
    return nextWindow.start;
  }

  _scheduleNext() {
    this._clearTimer();

    if (this.isPaused) {
      this.nextReminderTime = null;
      this._emitStatus();
      return;
    }

    const now = new Date();
    const intervalMs = this._getIntervalMinutes() * 60 * 1000;
    let candidate = new Date(now.getTime() + intervalMs);

    const currentWindow = this._activeWindowFor(now);
    if (candidate < currentWindow.start || candidate >= currentWindow.end) {
      candidate = this._nextActiveStart(candidate);
    }

    if (candidate <= now) {
      candidate = new Date(now.getTime() + 15 * 1000);
    }

    this.nextReminderTime = candidate.toISOString();
    const delay = Math.max(1000, candidate.getTime() - now.getTime());

    this.timer = setTimeout(() => {
      this.timer = null;

      if (this.isPaused) {
        this._emitStatus();
        return;
      }

      this.onReminder();
      this._scheduleNext();
      this._emitStatus();
    }, Math.min(delay, 2147483647));

    this._emitStatus();
  }
}

module.exports = ReminderScheduler;
