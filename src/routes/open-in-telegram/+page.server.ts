import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, '/');
  }

  return {
    telegramBotUsername: getConfig().publicTelegramBotUsername
  };
};
