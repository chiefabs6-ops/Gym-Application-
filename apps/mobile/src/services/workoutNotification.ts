import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Ongoing workout notification (ROADMAP 2.11): a silent, sticky card on the lock screen / shade showing the
 * current exercise, the next set's target and the rest countdown, with a "Complete set" button that logs the
 * set without opening (or unlocking) the phone. Re-presenting with the same identifier updates it in place.
 */
export const WORKOUT_NOTIFICATION_ID = 'active-workout';
export const WORKOUT_CATEGORY = 'active-workout';
export const COMPLETE_SET_ACTION = 'complete-set';
const CHANNEL_ID = 'workout-ongoing';

let configured = false;

export async function configureWorkoutNotification(): Promise<void> {
  if (configured) return;
  configured = true;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Workout in progress',
      description: 'Current exercise and next set, with a button to complete it from the lock screen',
      importance: Notifications.AndroidImportance.LOW, // no sound, no pop-up; stays in the shade + lock screen
      sound: null,
      enableVibrate: false,
      vibrationPattern: null,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync(WORKOUT_CATEGORY, [
    {
      identifier: COMPLETE_SET_ACTION,
      buttonTitle: 'Complete set ✓',
      options: { opensAppToForeground: false },
    },
  ]);
}

export interface WorkoutCard {
  title: string;
  body: string;
  /** false once every set is done: no button, just the summary. */
  canComplete: boolean;
}

let lastShown = '';

/** Shows or updates the card (skips identical updates so the shade doesn't flicker). */
export async function showWorkoutNotification(card: WorkoutCard): Promise<void> {
  const key = JSON.stringify(card);
  if (key === lastShown) return;
  lastShown = key;
  try {
    await configureWorkoutNotification();
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIFICATION_ID,
      content: {
        title: card.title,
        body: card.body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        categoryIdentifier: card.canComplete ? WORKOUT_CATEGORY : undefined,
        data: { kind: 'active-workout' },
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    lastShown = ''; // permission denied etc.: try again on the next change
  }
}

export async function dismissWorkoutNotification(): Promise<void> {
  lastShown = '';
  await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
}
