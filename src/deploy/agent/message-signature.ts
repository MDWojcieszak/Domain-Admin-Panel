import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signs and verifies messages between the backend and the deploy agent.
 *
 * The broker's credentials used to be the only thing standing between anyone
 * on the network and a root shell on the host: whoever could publish to the
 * agent's queue could send it a compose file to run, and whoever could publish
 * to the backend's deploy queue could ask for the git token. Every message now
 * carries an HMAC over its pattern, a timestamp and its payload, keyed with a
 * secret only the backend and the agent hold (DEPLOY_AGENT_KEY).
 *
 * The same file lives in the agent repository; the two must stay identical.
 */

/** Field added to the payload. Stripped by the receiver's whitelist pipe. */
export const SIGNATURE_FIELD = '_auth';

/**
 * Older than this is refused. A little past the deploy queue's 30-minute TTL,
 * since a message may legitimately sit in the queue that long while the
 * backend redeploys itself.
 */
const MAX_AGE_MS = 35 * 60 * 1000;

/** Clocks of the two hosts may disagree a little the other way. */
const MAX_FUTURE_MS = 5 * 60 * 1000;

export interface MessageAuth {
  ts: number;
  sig: string;
}

const digest = (
  key: string,
  pattern: string,
  ts: number,
  body: unknown,
): string =>
  createHmac('sha256', key)
    .update(`${pattern}\n${ts}\n${JSON.stringify(body)}`)
    .digest('hex');

const withoutAuth = (payload: object): Record<string, unknown> => {
  const rest = { ...(payload as Record<string, unknown>) };
  delete rest[SIGNATURE_FIELD];
  return rest;
};

/** The payload as sent: a plain copy with the signature attached. */
export const signMessage = <T extends object>(
  key: string,
  pattern: string,
  payload: T,
): Record<string, unknown> => {
  // Serialised once, the way the transport will: a class instance, Dates and
  // undefined fields all become what the receiver will actually see.
  const body = JSON.parse(JSON.stringify(withoutAuth(payload))) as Record<
    string,
    unknown
  >;
  const ts = Date.now();

  return {
    ...body,
    [SIGNATURE_FIELD]: { ts, sig: digest(key, pattern, ts, body) },
  };
};

/** Null when the message is authentic; otherwise why it is not. */
export const verifyMessage = (
  key: string,
  pattern: string,
  payload: unknown,
  now = Date.now(),
): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'payload is not an object';
  }

  const auth = (payload as Record<string, unknown>)[SIGNATURE_FIELD] as
    | Partial<MessageAuth>
    | undefined;
  if (!auth || typeof auth.ts !== 'number' || typeof auth.sig !== 'string') {
    return 'message is not signed';
  }

  if (now - auth.ts > MAX_AGE_MS) return 'signature has expired';
  if (auth.ts - now > MAX_FUTURE_MS) return 'signature is from the future';

  const expected = Buffer.from(
    digest(key, pattern, auth.ts, withoutAuth(payload)),
    'hex',
  );
  const presented = Buffer.from(auth.sig, 'hex');

  if (
    expected.length !== presented.length ||
    !timingSafeEqual(expected, presented)
  ) {
    return 'signature does not match';
  }

  return null;
};
