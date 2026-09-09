/** The single reader and writer of the stored session token. */
const TOKEN_KEY = 'lifebook_token';

export interface TokenPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Decodes (but does not cryptographically verify) the token for UI state -
 *  real verification always happens server-side in requireAuth. Returns null
 *  for a malformed or expired token so callers can treat both the same way. */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const json = atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
