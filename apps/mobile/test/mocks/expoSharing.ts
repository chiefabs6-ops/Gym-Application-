/** Records what the app tried to share (tests can inspect `shared`). */
export const shared: { url: string; mimeType?: string }[] = [];
export const shareAsync = async (url: string, opts?: { mimeType?: string }) => void shared.push({ url, mimeType: opts?.mimeType });
