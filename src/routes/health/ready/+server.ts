import { json } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { openDatabase } from '$lib/server/db/client';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  try {
    const config = getConfig();
    const database = openDatabase(config.databaseUrl);

    try {
      database.sqlite.prepare('select 1 from users limit 1').get();
    } finally {
      database.close();
    }

    return json(
      { status: 'ready' },
      {
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  } catch {
    return json(
      { status: 'not_ready' },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  }
};
