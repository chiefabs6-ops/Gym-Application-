export const setAudioModeAsync = async () => undefined;
export const createAudioPlayer = () => ({ volume: 1, play() {}, seekTo: async () => undefined });
export type AudioPlayer = ReturnType<typeof createAudioPlayer>;
