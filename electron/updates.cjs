'use strict';
const fs = require('fs');
const path = require('path');

function setupUpdates({ app, dialog, Notification, getWindow, updater }) {
  let busy = false;
  let downloaded = false;
  let disposed = false;
  let timer = null;
  let interval = null;
  const configured = app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  const show = (message, detail = '') => dialog.showMessageBox(getWindow(), {
    type: 'info', title: 'Siya updates', message, detail,
  });
  let autoUpdater = updater;
  if (configured) {
    autoUpdater ||= require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('error', (error) => {
      busy = false;
      console.error('Update failed:', error.message);
    });
    autoUpdater.on('update-downloaded', async () => {
      busy = false;
      downloaded = true;
      if (disposed) return;
      if (Notification.isSupported()) {
        new Notification({ title: 'Siya update ready', body: 'Restart Siya to install the downloaded update.' }).show();
      }
      await offerRestart();
    });
  }

  async function offerRestart() {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info', title: 'Siya update ready',
      message: 'Restart Siya to install the update?',
      detail: 'Your current voice session will end.',
      buttons: ['Later', 'Restart and install'], defaultId: 0, cancelId: 0,
    });
    if (response === 1 && !disposed) {
      // Ensure close-to-tray does not intercept the updater's window close.
      app.emit('before-quit');
      autoUpdater.quitAndInstall();
    }
  }

  async function check(manual = false) {
    if (disposed) return;
    if (!configured) {
      if (manual) await show('Automatic updates are not configured for this build.',
        app.isPackaged ? 'A release source must be supplied when packaging Siya.' : 'This is a development build. Install a released build to receive updates.');
      return;
    }
    if (downloaded) { if (manual) await offerRestart(); return; }
    if (busy) { if (manual) await show('An update check or download is already running.'); return; }
    busy = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.downloadPromise) {
        await result.downloadPromise;
      } else if (manual) {
        await show('Siya is up to date.');
      }
    } catch (error) {
      if (manual) await show('Could not check for updates.', error.message);
      else console.error('Update check failed:', error.message);
    } finally { busy = false; }
  }
  if (configured) {
    timer = setTimeout(() => void check(), 15000);
    interval = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    timer.unref();
    interval.unref();
  }
  return { check, dispose() { disposed = true; clearTimeout(timer); clearInterval(interval); } };
}
module.exports = { setupUpdates };
