import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import notifier from 'node-notifier';
import type NotificationCenter from 'node-notifier/notifiers/notificationcenter';
import type { SendPopup } from './popups';

/** Where Chrome keeps a web app installed with "Install page as app". */
const INSTALLED_APP = path.join(os.homedir(), 'Applications', 'Chrome Apps.localized', 'Planner.app');
const installedApp = () => (fs.existsSync(INSTALLED_APP) ? INSTALLED_APP : null);

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** What clicking a pop-up runs: open the page in the installed Planner window (an already open one comes to the front), or in the browser when the app isn't installed. */
export const clickCommand = (url: string, app: string | null) => (app ? `open -a ${shellQuote(app)} ${shellQuote(url)}` : `open ${shellQuote(url)}`);

/** A native macOS notification; clicking it opens the app at the pop-up's page. */
export const nativeNotify = (appUrl: string): SendPopup => (p) => {
  const options: NotificationCenter.Notification & { execute: string } = { title: p.title, message: p.body || ' ', execute: clickCommand(new URL(p.url, appUrl).href, installedApp()), sound: 'Glass' };
  console.log(`Pop-up ${p.at}: ${p.title}`);
  notifier.notify(options, (err) => {
    if (err) console.error('Pop-up failed:', err.message);
  });
};
