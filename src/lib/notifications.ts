/**
 * Real browser Notification API utilities.
 * Uses the Notifications API and Service Worker where available.
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationSupport(): { supported: boolean; reason?: string } {
  if (!('Notification' in window)) {
    return { supported: false, reason: 'Your browser does not support notifications.' };
  }
  if (!('serviceWorker' in navigator)) {
    return { supported: true, reason: 'Service Worker not supported — notifications will only work while the app is open.' };
  }
  return { supported: true };
}

export function getPermissionStatus(): NotificationPermissionStatus {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result as NotificationPermissionStatus;
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Try via service worker first (works when app is in background on mobile)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        // @ts-ignore
        vibrate: [100, 50, 100],
        ...options,
      });
    });
  } else {
    // Fallback to standard Notification
    new Notification(title, {
      icon: '/favicon.svg',
      ...options,
    });
  }
}

/**
 * Schedule a notification for a future time.
 * Uses setTimeout — works only while the app/tab is open.
 * For true background scheduling, a push notification server is required.
 */
export function scheduleNotification(
  title: string,
  body: string,
  scheduledTime: Date,
  tag?: string
): number | null {
  const now = Date.now();
  const delay = scheduledTime.getTime() - now;
  if (delay <= 0) return null;

  const timerId = window.setTimeout(() => {
    sendNotification(title, { body, tag: tag || 'scheduled' });
  }, delay);

  return timerId;
}

// Store scheduled timer IDs so they can be cancelled
const scheduledTimers: Map<string, number> = new Map();

export function scheduleEventReminder(
  eventId: string,
  eventName: string,
  eventTime: Date,
  reminderMinutes: number
): void {
  // Cancel any existing reminder for this event
  cancelEventReminder(eventId);

  const reminderTime = new Date(eventTime.getTime() - reminderMinutes * 60 * 1000);
  const body = reminderMinutes >= 60
    ? `${eventName} starts in ${reminderMinutes / 60} hour(s).`
    : `${eventName} starts in ${reminderMinutes} minutes.`;

  const timerId = scheduleNotification(
    '⏰ Upcoming Event',
    body,
    reminderTime,
    `event-${eventId}`
  );

  if (timerId !== null) {
    scheduledTimers.set(eventId, timerId);
  }
}

export function cancelEventReminder(eventId: string): void {
  const timerId = scheduledTimers.get(eventId);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    scheduledTimers.delete(eventId);
  }
}
