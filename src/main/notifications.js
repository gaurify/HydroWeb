const { Notification } = require('electron');

function showNativeNotification() {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: 'HydroWeb Reminder',
    body: 'Time to drink water 💧'
  });

  notification.show();
}

function showOverlay(overlayWindow, mainWindow, settings = {}) {
  const overlayEnabled = settings.overlayEnabled !== false;

  if (!overlayEnabled) {
    showNativeNotification();
    return;
  }

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    showNativeNotification();
    return;
  }

  if (overlayWindow.webContents) {
    overlayWindow.webContents.send('overlay-data', {
      title: 'Hydration Check-In',
      message: 'Your friendly neighborhood reminder says: drink some water.',
      soundEnabled: settings.soundEnabled !== false
    });
  }

  overlayWindow.showInactive();
  overlayWindow.focus();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay-opened');
  }
}

function hideOverlay(overlayWindow) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.hide();
}

module.exports = {
  showOverlay,
  hideOverlay
};
