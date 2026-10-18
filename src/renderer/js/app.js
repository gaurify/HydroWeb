(() => {
  const appContainer = document.getElementById('app-container');
  const navItems = Array.from(document.querySelectorAll('.nav-item'));

  const pages = {
    dashboard: window.DashboardPage,
    settings: window.SettingsPage,
    manual: {
      render: () => `
        <section class="card">
          <h1>Manual</h1>
          <p class="muted">How to use HydroWeb</p>
          <ol class="manual-list">
            <li>Set your daily goal and reminder schedule in <strong>Settings</strong>.</li>
            <li>Use quick-add buttons or custom amount on <strong>Dashboard</strong>.</li>
            <li>Use pause/resume when you need quiet hours.</li>
            <li>If Appwrite is not configured, HydroWeb stores everything locally.</li>
            <li>For desktop reminders, keep the app running in the tray.</li>
          </ol>
          <h2>Troubleshooting</h2>
          <ul class="manual-list">
            <li>If browser reminders do not appear, allow notification permission.</li>
            <li>If desktop reminders stop, verify reminders are not paused.</li>
            <li>If Appwrite sync fails, local storage remains active automatically.</li>
          </ul>
        </section>
      `,
      mount: async () => {}
    }
  };

  let currentPage = null;

  function setActiveNav(pageName) {
    navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === pageName));
  }

  async function renderPage(pageName) {
    const page = pages[pageName] || pages.dashboard;

    if (currentPage && typeof currentPage.unmount === 'function') {
      currentPage.unmount();
    }

    appContainer.innerHTML = page.render();
    setActiveNav(pageName);
    currentPage = page;

    if (typeof page.mount === 'function') {
      await page.mount();
    }
  }

  async function initAppwrite() {
    if (!window.AppwriteBackend || !window.AppwriteBackend.init) return;

    let runtimeConfig = {};
    try {
      const raw = localStorage.getItem('hydroweb_appwrite_config');
      runtimeConfig = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      runtimeConfig = {};
    }

    await window.AppwriteBackend.init(runtimeConfig);
  }

  function setupWindowControls() {
    const minimize = document.getElementById('btn-minimize');
    const close = document.getElementById('btn-close');

    if (minimize) {
      minimize.addEventListener('click', () => {
        if (window.hydroweb && window.hydroweb.minimizeWindow) {
          window.hydroweb.minimizeWindow();
        }
      });
    }

    if (close) {
      close.addEventListener('click', () => {
        if (window.hydroweb && window.hydroweb.closeWindow) {
          window.hydroweb.closeWindow();
        }
      });
    }
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => renderPage(item.dataset.page));
  });

  (async () => {
    setupWindowControls();
    await initAppwrite();
    await renderPage('dashboard');
  })();
})();
