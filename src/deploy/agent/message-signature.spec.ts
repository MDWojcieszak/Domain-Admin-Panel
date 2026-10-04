import {
  SIGNATURE_FIELD,
  signMessage,
  verifyMessage,
} from './message-signature';

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEY = 'test-deploy-agent-key';

/** What the receiver gets: the transport serialises and parses the payload. */
const overTheWire = (payload: unknown) => JSON.parse(JSON.stringify(payload));

describe('message signature', () => {
  class Event {
    constructor(
      public project: string,
      public at: Date,
      public optional?: string,
    ) {}
  }

  it('accepts what was signed, after a round trip through the transport', () => {
    const sent = signMessage(
      KEY,
      'stack.action',
      new Event('immich', new Date()),
    );
    expect(verifyMessage(KEY, 'stack.action', overTheWire(sent))).toBeNull();
  });

  it('refuses an unsigned message — anyone on the broker could send one', () => {
    expect(verifyMessage(KEY, 'deploy.execute', { slug: 'x' })).toBe(
      'message is not signed',
    );
  });

  it('refuses a changed payload', () => {
    const sent = overTheWire(
      signMessage(KEY, 'deploy.execute', { compose: 'safe' }),
    );
    sent.compose = 'services: { evil: { image: alpine, privileged: true } }';
    expect(verifyMessage(KEY, 'deploy.execute', sent)).toBe(
      'signature does not match',
    );
  });

  it('refuses a signature moved to another pattern', () => {
    const sent = overTheWire(
      signMessage(KEY, 'stack.logs', { project: 'immich' }),
    );
    expect(verifyMessage(KEY, 'stack.action', sent)).toBe(
      'signature does not match',
    );
  });

  it('refuses another key', () => {
    const sent = overTheWire(
      signMessage('someone-else', 'stack.logs', { a: 1 }),
    );
    expect(verifyMessage(KEY, 'stack.logs', sent)).toBe(
      'signature does not match',
    );
  });

  it('refuses an old message, accepts one inside the queue TTL', () => {
    const sent = overTheWire(signMessage(KEY, 'stack.logs', { a: 1 }));
    const ts = sent[SIGNATURE_FIELD].ts;

    expect(
      verifyMessage(KEY, 'stack.logs', sent, ts + 30 * 60 * 1000),
    ).toBeNull();
    expect(verifyMessage(KEY, 'stack.logs', sent, ts + 36 * 60 * 1000)).toBe(
      'signature has expired',
    );
  });

  it('refuses a garbled signature without throwing', () => {
    const sent = overTheWire(signMessage(KEY, 'stack.logs', { a: 1 }));
    sent[SIGNATURE_FIELD].sig = 'not-hex';
    expect(verifyMessage(KEY, 'stack.logs', sent)).toBe(
      'signature does not match',
    );
  });
});
