import type { UserRow } from '@gym/shared';
import { adoptServerUser, getUserId } from '../db/repositories/user';
import { apiFetch, clearToken, setToken } from '../db/sync/api';
import { requestSync } from '../db/sync/syncManager';

interface AuthResponse {
  token: string;
  user: UserRow;
}

/** Registers using the local guest id, so everything logged offline is already correctly owned. */
export async function register(email: string, password: string, displayName?: string): Promise<UserRow> {
  const res = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: { id: await getUserId(), email, password, display_name: displayName ?? null },
  });
  await setToken(res.token);
  await adoptServerUser(res.user);
  requestSync(0);
  return res.user;
}

export async function login(email: string, password: string): Promise<UserRow> {
  const res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  await setToken(res.token);
  await adoptServerUser(res.user);
  requestSync(0);
  return res.user;
}

export const logout = () => clearToken();
