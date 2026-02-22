import * as Notifications from 'expo-notifications';
import { getItem } from './storage';

const SETTINGS_KEYS = { checkInReminder: 'checkInReminder', checkOutReminder: 'checkOutReminder', notifyEnabled: 'notifyEnabled' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminders() {
  const enabled = await getItem<boolean>(SETTINGS_KEYS.notifyEnabled);
  if (!enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  const checkInStr = (await getItem<string>(SETTINGS_KEYS.checkInReminder)) ?? '09:00';
  const checkOutStr = (await getItem<string>(SETTINGS_KEYS.checkOutReminder)) ?? '18:00';
  const [inH, inM] = checkInStr.split(':').map(Number);
  const [outH, outM] = checkOutStr.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Attendance', body: "Don't forget to check in!", sound: true },
    trigger: { hour: inH, minute: inM, repeats: true },
    identifier: 'check-in-reminder',
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Attendance', body: "Don't forget to check out!", sound: true },
    trigger: { hour: outH, minute: outM, repeats: true },
    identifier: 'check-out-reminder',
  });
}
