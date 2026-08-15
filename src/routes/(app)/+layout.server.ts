import type { LayoutServerLoad } from './$types';
import { requirePageUser } from '$lib/server/auth/guard';

export const load: LayoutServerLoad = ({ locals }) => {
  const user = requirePageUser(locals);

  return {
    user: {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      isAdmin: user.isAdmin
    }
  };
};
