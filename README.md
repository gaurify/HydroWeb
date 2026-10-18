# HydroWeb

HydroWeb is a Spider-Man-inspired hydration reminder app for Electron (Windows desktop) and web browsers.

## Current capabilities

- Dashboard with hydration progress, streak, reminder status, and recent history.
- Quick-add and custom water logging in mL.
- Settings for daily goal, reminder interval, active hours, sound, overlay, and startup preference.
- Reminder pause/resume and manual test reminder.
- Electron tray integration, secure preload bridge (`contextIsolation: true`, `nodeIntegration: false`).
- Browser/web fallback using local storage.
- Optional Appwrite sync when explicitly configured.

## Project structure

- Main process: `/home/runner/work/HydroWeb/HydroWeb/src/main/main.js`
- Renderer entry: `/home/runner/work/HydroWeb/HydroWeb/src/renderer/index.html`
- Web server: `/home/runner/work/HydroWeb/HydroWeb/server.js`

## Setup

```bash
npm install
```

## Run desktop (Electron)

```bash
npm start
```

## Run web version

```bash
npm run web
```

Then open `http://localhost:3000`.

## Build Windows package

```bash
npm run build
```

> Building Windows targets on Linux may require Wine (`wine`) depending on your environment.

## Appwrite configuration (optional)

HydroWeb does **not** require Appwrite to run.
If Appwrite is not configured, HydroWeb uses local storage automatically.

To enable Appwrite:

1. Create an Appwrite project, database, and two collections (settings + daily stats).
2. In the browser console, set runtime config (replace with your real values):

```js
localStorage.setItem('hydroweb_appwrite_config', JSON.stringify({
  endpoint: 'https://cloud.appwrite.io/v1',
  projectId: '<YOUR_PROJECT_ID>',
  databaseId: '<YOUR_DATABASE_ID>',
  settingsCollectionId: '<YOUR_SETTINGS_COLLECTION_ID>',
  statsCollectionId: '<YOUR_STATS_COLLECTION_ID>'
}));
```

3. Reload the app.

Never put API keys or privileged secrets in renderer code.

## Limitations

- Browser reminders work while the tab/app is open; browsers cannot guarantee reminders after all browser processes are fully closed.
- Desktop reminders require the app process to remain running (tray/background supported).
