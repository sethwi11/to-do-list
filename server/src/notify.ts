import notifier from 'node-notifier';
import type NotificationCenter from 'node-notifier/notifiers/notificationcenter';
import type { SendPopup } from './popups';

/** A native macOS notification; clicking it opens the app at the pop-up's page. */
export const nativeNotify = (appUrl: string): SendPopup => (p) => {
  const options: NotificationCenter.Notification = { title: p.title, message: p.body || ' ', open: new URL(p.url, appUrl).href, sound: 'Glass' };
  console.log(`Pop-up ${p.at}: ${p.title}`);
  notifier.notify(options, (err) => {
    if (err) console.error('Pop-up failed:', err.message);
  });
};
