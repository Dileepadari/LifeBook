/**
 * The one ecosystem session this app runs on.
 *
 * LifeOS used to keep its own login token in localStorage. Now it shares the
 * ecosystem's session: the access token lives in memory, the refresh token is an
 * HttpOnly cookie on `.dileepadari.dev`, and signing in on any app in the
 * ecosystem signs you in here too. All of LifeOS's data now lives behind the
 * shared gateway under `/apps/lifebook`, reached with this session's token.
 *
 * @module session
 */
import { createSessionClient } from '@completeos/auth-client';

const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'https://api.dileepadari.dev';

export const session = createSessionClient({ baseUrl: GATEWAY });

/** Where every LifeOS API call is rooted, now that the app lives on the gateway. */
export const LIFEBOOK_API_BASE = `${GATEWAY}/apps/lifebook`;
