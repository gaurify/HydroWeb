window.DashboardPage = {
  _countdownTimer: null,
  _reminderStatus: { isPaused: false, nextReminderTime: null },

  render() {
    return `
      <section class="card dashboard-card" aria-live="polite">
        <h1>Dashboard</h1>
        <p class="muted">Track your hydration and stay consistent.</p>

        <div id="flash-message" class="flash-message" hidden></div>

        <div class="progress-layout">
          <div class="progress-ring-wrap" aria-label="Today's hydration progress">
            <svg class="progress-ring" width="150" height="150" viewBox="0 0 150 150">
              <circle class="ring-bg" cx="75" cy="75" r="62"></circle>
              <circle class="ring-fill" cx="75" cy="75" r="62" id="progress-ring-fill"></circle>
            </svg>
            <div class="progress-center">
              <span id="progress-percent">0%</span>
            </div>
          </div>

          <div class="stats-grid">
            <article class="metric"><span class="label">Today</span><strong id="today-volume">0 mL</strong></article>
            <article class="metric"><span class="label">Goal</span><strong id="goal-volume">0 mL</strong></article>
            <article class="metric"><span class="label">Streak</span><strong id="streak">0 days</strong></article>
            <article class="metric"><span class="label">Reminders</span><strong id="reminders-count">0</strong></article>
          </div>
        </div>

        <div class="quick-actions">
          <button class="btn quick-add" data-amount="100">+100 mL</button>
          <button class="btn quick-add" data-amount="250">+250 mL</button>
          <button class="btn quick-add" data-amount="500">+500 mL</button>
        </div>

        <form id="custom-amount-form" class="custom-amount-row">
          <label for="custom-amount">Custom amount (mL)</label>
          <input id="custom-amount" name="custom-amount" type="number" min="1" max="2000" value="300" required>
          <button class="btn btn-primary" type="submit">Add water</button>
        </form>

        <section class="reminder-status card-subtle">
          <h2>Reminder status</h2>
          <p id="status-text">Active</p>
          <p id="next-reminder">Next reminder: --</p>
          <div class="reminder-actions">
            <button class="btn" id="pause-resume-btn">Pause reminders</button>
            <button class="btn" id="test-reminder-btn">Test reminder</button>
          </div>
        </section>

        <section class="card-subtle history-panel">
          <h2>Recent history (7 days)</h2>
          <ul id="history-list" class="history-list"></ul>
        </section>
      </section>
    `;
  },

  async mount() {
    const ringFill = document.getElementById('progress-ring-fill');
    const percentEl = document.getElementById('progress-percent');
    const todayEl = document.getElementById('today-volume');
    const goalEl = document.getElementById('goal-volume');
    const streakEl = document.getElementById('streak');
    const remindersEl = document.getElementById('reminders-count');
    const nextReminderEl = document.getElementById('next-reminder');
    const statusTextEl = document.getElementById('status-text');
    const historyList = document.getElementById('history-list');

    const flash = (message, isError = false) => {
      const el = document.getElementById('flash-message');
      if (!el) return;
      el.hidden = false;
      el.classList.toggle('error', isError);
      el.textContent = message;
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => {
        el.hidden = true;
      }, 2000);
    };

    const renderStatus = () => {
      const status = this._reminderStatus || { isPaused: false, nextReminderTime: null };
      statusTextEl.textContent = status.isPaused ? 'Paused' : 'Active';
      const pauseResumeBtn = document.getElementById('pause-resume-btn');
      if (pauseResumeBtn) pauseResumeBtn.textContent = status.isPaused ? 'Resume reminders' : 'Pause reminders';

      if (!status.nextReminderTime) {
        nextReminderEl.textContent = status.isPaused ? 'Next reminder: paused' : 'Next reminder: --';
        return;
      }

      const target = new Date(status.nextReminderTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      nextReminderEl.textContent = `Next reminder in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const renderStats = async (stats) => {
      const settings = await window.Storage.getSettings();
      const useOz = settings.volumeUnit === 'oz';
      const convert = (ml) => (useOz ? `${(ml / 29.5735).toFixed(1)} oz` : `${Math.round(ml)} mL`);

      const progress = Math.max(0, Math.min(100, Number(stats.progressPercent || 0)));
      const radius = 62;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (progress / 100) * circumference;
      ringFill.style.strokeDasharray = `${circumference}`;
      ringFill.style.strokeDashoffset = `${offset}`;

      percentEl.textContent = `${progress}%`;
      todayEl.textContent = convert(stats.volumeMl || 0);
      goalEl.textContent = convert(stats.goalVolumeMl || 0);
      streakEl.textContent = `${stats.streak || 0} day${stats.streak === 1 ? '' : 's'}`;
      remindersEl.textContent = String(stats.reminders || 0);

      const history = (stats.history || []).slice(0, 7);
      historyList.innerHTML = history.length
        ? history.map((row) => `<li><span>${row.date}</span><strong>${convert(row.totalMl || 0)}</strong></li>`).join('')
        : '<li><span>No history yet.</span></li>';
    };

    document.querySelectorAll('.quick-add').forEach((button) => {
      button.addEventListener('click', async () => {
        const amount = Number(button.dataset.amount || 0);
        try {
          const stats = await window.Storage.recordWater(amount);
          await renderStats(stats);
          flash(`Logged ${amount} mL.`);
        } catch (error) {
          flash(error.message || 'Unable to log water.', true);
        }
      });
    });

    document.getElementById('custom-amount-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('custom-amount');
      const amount = Number(input.value || 0);
      try {
        const stats = await window.Storage.recordWater(amount);
        await renderStats(stats);
        flash(`Logged ${amount} mL.`);
      } catch (error) {
        flash(error.message || 'Unable to log water.', true);
      }
    });

    document.getElementById('pause-resume-btn').addEventListener('click', async () => {
      this._reminderStatus = this._reminderStatus?.isPaused
        ? await window.Storage.resumeReminders()
        : await window.Storage.pauseReminders();
      renderStatus();
    });

    document.getElementById('test-reminder-btn').addEventListener('click', async () => {
      if (window.hydroweb && window.hydroweb.showOverlay) {
        await window.hydroweb.showOverlay();
      }
      flash('Test reminder triggered.');
    });

    window.Storage.onStatsUpdated(async (stats) => {
      await renderStats(stats);
    });

    window.Storage.onReminderStatusChanged((status) => {
      this._reminderStatus = status;
      renderStatus();
    });

    const [stats, status] = await Promise.all([
      window.Storage.getStats(),
      window.Storage.getReminderStatus()
    ]);

    this._reminderStatus = status;
    await renderStats(stats);
    renderStatus();

    clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(renderStatus, 1000);
  },

  unmount() {
    clearInterval(this._countdownTimer);
  }
};
