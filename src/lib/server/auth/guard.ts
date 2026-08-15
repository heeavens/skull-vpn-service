import { redirect } from '@sveltejs/kit';
import type { AuthenticatedUser } from '$lib/types/auth';

export function requirePageUser(locals: App.Locals): AuthenticatedUser {
  if (!locals.user) {
    redirect(303, '/open-in-telegram');
  }

  return locals.user;
}
