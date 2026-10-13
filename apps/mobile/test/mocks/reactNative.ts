export const AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
export const Vibration = { vibrate: () => undefined };
export const Platform = { OS: 'android', select: <T>(o: { android?: T; default?: T }) => o.android ?? o.default };
export const Keyboard = { addListener: () => ({ remove() {} }) };
export const Linking = { openURL: async () => undefined };
