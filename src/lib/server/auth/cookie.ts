import type { Cookies } from '@sveltejs/kit';
import type { AuthenticatedSession } from './session';

export const SESSION_COOKIE_NAME = 'vpn_session';

const cookieSecurityOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/'
};

export function readSessionCookie(cookies: Cookies): string | undefined {
  return cookies.get(SESSION_COOKIE_NAME);
}

export function setSessionCookie(cookies: Cookies, session: AuthenticatedSession): void {
  cookies.set(SESSION_COOKIE_NAME, session.token, {
    ...cookieSecurityOptions,
    expires: session.expiresAt
  });
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE_NAME, cookieSecurityOptions);
}
