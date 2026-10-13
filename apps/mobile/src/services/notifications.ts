import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Rest-timer completion alerts.
 * - Play our own finish beep (bundled via the expo-notifications plugin `sounds` in app.json).
 * - Use the ALARM audio stream, like a clock app's timer: follows alarm volume and is audible when locked.
 * Android channels are immutable once created: to change sound/attributes, add a new id and delete the old one.
 */
const LEGACY_CHANNELS = ['rest-timer'];
const REST_SOUND = 'rest_finish.wav';
const INTERVAL_KIND = 'interval-alert';

/**
 * Android fixes sound/vibration per channel, so there's one channel per Settings combination
 * (rest sound × rest vibration). 'rest-timer-v2' keeps its id so existing installs keep the user's
 * system-level tweaks to the default channel.
 */
const REST_CHANNELS = {
  soundVibrate: { id: 'rest-timer-v2', name: 'Rest timer', sound: true, vibrate: true },
  soundOnly: { id: 'rest-timer-sound', name: 'Rest timer (no vibration)', sound: true, vibrate: false },
  vibrateOnly: { id: 'rest-timer-vibrate', name: 'Rest timer (vibrate only)', sound: false, vibrate: true },
  silent: { id: 'rest-timer-silent', name: 'Rest timer (silent)', sound: false, vibrate: false },
} as const;

export interface RestAlertStyle {
  sound: boolean;
  vibrate: boolean;
}

const channelFor = ({ sound, vibrate }: RestAlertStyle) =>
  sound ? (vibrate ? REST_CHANNELS.soundVibrate : REST_CHANNELS.soundOnly) : vibrate ? REST_CHANNELS.vibrateOnly : REST_CHANNELS.silent;

export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    // This handler only runs while the app is in the foreground. The rest timer then plays its own
    // countdown/finish beeps (useRestTimerCues), so keep the notification silent and out of the way.
    // In the background the OS shows it with sound as normal.
    // Interval-timer alerts are hidden entirely in the foreground: the app beeps and shows the phase itself.
    handleNotification: async (n) => {
      const interval = n.request.content.data?.kind === INTERVAL_KIND;
      if (interval) console.log(`[interval] alert in foreground "${n.request.content.title}" at ${Date.now()}`);
      return { shouldShowBanner: false, shouldShowList: !interval, shouldPlaySound: false, shouldSetBadge: false };
    },
  });

  if (Platform.OS === 'android') {
    for (const ch of Object.values(REST_CHANNELS)) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        description: 'Alerts you when your rest between sets is over',
        importance: Notifications.AndroidImportance.HIGH,
        sound: ch.sound ? REST_SOUND : null,
        // ALARM stream: follows alarm volume (usually high) like a clock app's timer, audible when locked.
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
        enableVibrate: ch.vibrate,
        vibrationPattern: ch.vibrate ? [0, 400, 200, 400] : null,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    for (const id of LEGACY_CHANNELS) {
      await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
    }
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

/**
 * Scheduled with the OS (AlarmManager on Android), so it fires even if the JS runtime
 * is suspended, the screen is off, or the app process is killed.
 */
export async function scheduleRestDone(seconds: number, style: RestAlertStyle): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest complete', body: 'Time for your next set 💪', sound: style.sound ? REST_SOUND : false },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: channelFor(style).id,
      },
    });
  } catch {
    return null; // Permission denied: in-app timer still works.
  }
}

/**
 * Interval timer phase change at an exact time (OS-scheduled like scheduleRestDone, so it fires while locked).
 * Uses the rest-timer channels: same alarm-stream beep and the user's sound/vibration choice.
 */
export async function scheduleAlertAt(at: number, title: string, body: string, style: RestAlertStyle): Promise<string | null> {
  if (at <= Date.now()) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: style.sound ? REST_SOUND : false, data: { kind: INTERVAL_KIND } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: channelFor(style).id },
    });
  } catch {
    return null; // Permission denied: the in-app countdown still works.
  }
}

/** Removes interval alerts still showing in the notification shade (posted while the phone was locked). */
export async function dismissIntervalAlerts(): Promise<void> {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => n.request.content.data?.kind === INTERVAL_KIND)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // Nothing to tidy up.
  }
}

export async function cancelScheduled(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}
