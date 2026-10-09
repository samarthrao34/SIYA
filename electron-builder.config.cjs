'use strict';
const releaseUrl = process.env.SIYA_UPDATE_URL;
if (releaseUrl && new URL(releaseUrl).protocol !== 'https:') {
  throw new Error('SIYA_UPDATE_URL must use HTTPS.');
}
module.exports = {
  appId: 'com.siya.desktop',
  productName: 'SIYA',
  asar: false,
  directories: { output: 'release' },
  files: ['dist/**/*', 'electron/**/*', 'build/icon.png', 'package.json', 'services/desktop_agent/**/*.py'],
  linux: { target: ['AppImage'], category: 'Utility', icon: 'build/icon.png' },
  win: { target: ['nsis'] },
  mac: { target: ['dmg', 'zip'], category: 'public.app-category.utilities' },
  publish: releaseUrl ? [{ provider: 'generic', url: releaseUrl }] : null,
};
