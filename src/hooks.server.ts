import { randomUUID } from 'node:crypto';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { clearSessionCookie, readSessionCookie } from '$lib/server/auth/cookie';
import { getAuthService } from '$lib/server/auth/runtime';
import { getConfig } from '$lib/server/config';

export const init: ServerInit = () => {
  getConfig();
};

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = randomUUID();
  event.locals.user = null;

  const isHealthEndpoint =
    event.url.pathname === '/health/live' || event.url.pathname === '/health/ready';

  if (!isHealthEndpoint) {
    const token = readSessionCookie(event.cookies);
    if (token) {
      event.locals.user = getAuthService().resolveSession(token);

      if (!event.locals.user) {
        clearSessionCookie(event.cookies);
      }
    }
  }

  const response = await resolve(event);
  response.headers.set('x-request-id', event.locals.requestId);
  return response;
};
