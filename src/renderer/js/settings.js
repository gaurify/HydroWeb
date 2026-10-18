window.SettingsPage = {
  render() {
    return `
      <section class="card settings-card">
        <h1>Settings</h1>
        <p class="muted">Configure reminders and preferences.</p>

        <form id="settings-form" class="settings-form">
          <label>Reminder interval (minutes)
            <input type="number" name="intervalMinutes" min="5" max="240" required>
          </label>

          <div class="time-grid">
            <label>Active from
              <input type="time" name="activeHoursStart" required>
            </label>
            <label>Active until
              <input type="time" name="activeHoursEnd" required>
            </label>
          </div>

          <label>Daily goal (mL)
            <input type="number" name="dailyGoalMl" min="250" max="10000" required>
          </label>

          <label>Volume unit
            <select name="volumeUnit">
              <option value="ml">mL</option>
              <option value="oz">oz</option>
            </select>
          </label>

          <label class="switch-row"><input type="checkbox" name="soundEnabled"> Enable reminder sound</label>
          <label class="switch-row"><input type="checkbox" name="overlayEnabled"> Enable overlay reminders (desktop)</label>
          <label class="switch-row"><input type="checkbox" name="startOnBoot"> Start on Windows login (desktop)</label>

          <div class="settings-actions">
            <button type="submit" class="btn btn-primary">Save settings</button>
            <button type="button" class="btn" id="request-notification">Enable browser notifications</button>
          </div>
        </form>

        <div id="settings-message" class="flash-message" hidden></div>
      </section>
    `;
  },

  async mount() {
    const form = document.getElementById('settings-form');
    const message = document.getElementById('settings-message');

    const flash = (text, isError = false) => {
      message.hidden = false;
      message.classList.toggle('error', isError);
      message.textContent = text;
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => {
        message.hidden = true;
      }, 2500);
    };

    const settings = await window.Storage.getSettings();
    form.intervalMinutes.value = settings.intervalMinutes;
    form.activeHoursStart.value = settings.activeHoursStart;
    form.activeHoursEnd.value = settings.activeHoursEnd;
    form.dailyGoalMl.value = settings.dailyGoalMl;
    form.volumeUnit.value = settings.volumeUnit;
    form.soundEnabled.checked = Boolean(settings.soundEnabled);
    form.overlayEnabled.checked = Boolean(settings.overlayEnabled);
    form.startOnBoot.checked = Boolean(settings.startOnBoot);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const next = {
        intervalMinutes: Number(form.intervalMinutes.value),
        activeHoursStart: form.activeHoursStart.value,
        activeHoursEnd: form.activeHoursEnd.value,
        dailyGoalMl: Number(form.dailyGoalMl.value),
        volumeUnit: form.volumeUnit.value,
        soundEnabled: form.soundEnabled.checked,
        overlayEnabled: form.overlayEnabled.checked,
        startOnBoot: form.startOnBoot.checked
      };

      if (next.dailyGoalMl < 250 || next.dailyGoalMl > 10000) {
        flash('Daily goal must be between 250 and 10000 mL.', true);
        return;
      }

      if (next.intervalMinutes < 5 || next.intervalMinutes > 240) {
        flash('Interval must be between 5 and 240 minutes.', true);
        return;
      }

      try {
        await window.Storage.saveSettings(next);
        flash('Settings saved.');
      } catch (error) {
        flash(error.message || 'Unable to save settings.', true);
      }
    });

    document.getElementById('request-notification').addEventListener('click', async () => {
      if (!('Notification' in window)) {
        flash('This browser does not support notifications.', true);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        flash('Browser notifications enabled.');
      } else {
        flash('Notification permission was not granted.', true);
      }
    });
  }
};
