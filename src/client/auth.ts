// ---------------------------------------------------------------------------
// THE SERVICE RECORD (auth). Two providers, one seam:
//
//   · LOCAL (always available, offline-first): the device IS the session.
//     Enlistment (identity.ts) creates the soldier; this module stamps a
//     durable device-session id so "signed in on the tablet" is a real,
//     inspectable state — sign out wipes it and the front door re-enlists.
//
//   · SUPABASE (email one-time code): fully wired, ZERO dependencies — plain
//     GoTrue REST. It lights up the moment a project exists and two env vars
//     land in .env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY. No project is
//     provisioned from here — creating cloud infra is Robert's call (#83).
//
// Sessions persist in localStorage. Nothing in here touches the sim.
// ---------------------------------------------------------------------------

export interface AuthSession {
  provider: 'local' | 'supabase';
  userId: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  /** epoch ms when the access token dies (supabase only) */
  expiresAt?: number;
}

const KEY = 'ww_session';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const SUPA_URL = env.VITE_SUPABASE_URL;
const SUPA_KEY = env.VITE_SUPABASE_ANON_KEY;

/** True when the network provider is configured — the SIGN IN door shows. */
export const supabaseConfigured = !!(SUPA_URL && SUPA_KEY);

function load(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s && (s.provider === 'local' || s.provider === 'supabase') && typeof s.userId === 'string') return s;
  } catch { /* fresh device / private mode */ }
  return null;
}

function save(s: AuthSession): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/** The current session — creating the local one on first ask (the tablet is
 *  "signed in" from its first boot; enlistment names the soldier). */
export function currentSession(): AuthSession {
  const s = load();
  if (s) return s;
  const fresh: AuthSession = {
    provider: 'local',
    userId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}`,
  };
  save(fresh);
  return fresh;
}

/** Sign out: drop the session. The caller owns what happens to the identity
 *  (the front door re-enlists on next boot if it's cleared too). */
export function signOut(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

// ── the Supabase (GoTrue REST) half — live once env vars exist ─────────────
async function gotrue(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPA_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPA_KEY! },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { msg?: string; error_description?: string }).msg
    ?? (json as { error_description?: string }).error_description ?? `auth ${res.status}`);
  return json as Record<string, unknown>;
}

/** Step 1: email a one-time code. */
export async function requestCode(email: string): Promise<void> {
  if (!supabaseConfigured) throw new Error('network auth is not configured on this build');
  await gotrue('otp', { email, create_user: true });
}

/** Step 2: trade the code for a session. */
export async function verifyCode(email: string, code: string): Promise<AuthSession> {
  if (!supabaseConfigured) throw new Error('network auth is not configured on this build');
  const json = await gotrue('verify', { email, token: code, type: 'email' });
  const user = json.user as { id?: string } | undefined;
  const s: AuthSession = {
    provider: 'supabase',
    userId: user?.id ?? 'unknown',
    email,
    accessToken: json.access_token as string | undefined,
    refreshToken: json.refresh_token as string | undefined,
    expiresAt: Date.now() + ((json.expires_in as number | undefined) ?? 3600) * 1000,
  };
  save(s);
  return s;
}

/** Boot refresh: a stale supabase token quietly renews; local never expires. */
export async function restoreSession(): Promise<AuthSession> {
  const s = currentSession();
  if (s.provider !== 'supabase' || !s.refreshToken) return s;
  if (s.expiresAt && s.expiresAt - Date.now() > 60_000) return s;
  try {
    const json = await gotrue('token?grant_type=refresh_token', { refresh_token: s.refreshToken });
    const renewed: AuthSession = {
      ...s,
      accessToken: json.access_token as string | undefined,
      refreshToken: (json.refresh_token as string | undefined) ?? s.refreshToken,
      expiresAt: Date.now() + ((json.expires_in as number | undefined) ?? 3600) * 1000,
    };
    save(renewed);
    return renewed;
  } catch {
    return s; // offline — the stale session still identifies the soldier locally
  }
}
