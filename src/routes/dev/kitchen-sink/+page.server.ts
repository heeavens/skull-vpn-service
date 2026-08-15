import { requirePageUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  requirePageUser(locals);
  return {};
};
