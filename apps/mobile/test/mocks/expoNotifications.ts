export const AndroidImportance = { HIGH: 4 };
export const AndroidAudioUsage = { ALARM: 4 };
export const AndroidAudioContentType = { SONIFICATION: 4 };
export const AndroidNotificationVisibility = { PUBLIC: 1 };
export const SchedulableTriggerInputTypes = { TIME_INTERVAL: 'timeInterval', DATE: 'date' };
export const setNotificationHandler = () => undefined;
export const setNotificationChannelAsync = async () => null;
export const deleteNotificationChannelAsync = async () => undefined;
export const getPermissionsAsync = async () => ({ status: 'granted' });
export const requestPermissionsAsync = async () => ({ status: 'granted' });
let n = 0;
/** Scheduled (not yet cancelled) notifications, for tests. */
export const scheduled = new Map<string, unknown>();
export const scheduleNotificationAsync = async (request: unknown) => {
  const id = `notif-${++n}`;
  scheduled.set(id, request);
  return id;
};
export const cancelScheduledNotificationAsync = async (id: string) => {
  scheduled.delete(id);
};
export const getPresentedNotificationsAsync = async () => [];
export const dismissNotificationAsync = async () => undefined;
