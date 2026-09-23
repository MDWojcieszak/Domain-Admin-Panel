import { RmqContext } from '@nestjs/microservices';

import { ack, reject, settle } from './rmq-ack';

const channel = () => ({ ack: jest.fn(), nack: jest.fn() });

const contextWith = (ch: ReturnType<typeof channel>) =>
  ({
    getChannelRef: () => ch,
    getMessage: () => ({ fields: { deliveryTag: 1 } }),
  }) as unknown as RmqContext;

const brokenContext = () =>
  ({
    getChannelRef: () => {
      throw new Error('no channel');
    },
    getMessage: () => undefined,
  }) as unknown as RmqContext;

describe('rmq-ack', () => {
  it('acknowledges a message', () => {
    const ch = channel();
    ack(contextWith(ch));

    expect(ch.ack).toHaveBeenCalledTimes(1);
  });

  // A failure to acknowledge must not become a second failure on top of the first.
  it('never throws when the channel is unavailable', () => {
    expect(() => ack(brokenContext())).not.toThrow();
    expect(() => reject(brokenContext(), new Error('x'))).not.toThrow();
  });

  // Requeueing a message the handler just failed on spins a poison loop.
  it('rejects without requeueing', () => {
    const ch = channel();
    reject(contextWith(ch), new Error('bad payload'));

    expect(ch.nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });

  describe('settle', () => {
    it('acknowledges and returns the result on success', async () => {
      const ch = channel();

      await expect(settle(contextWith(ch), async () => 'done')).resolves.toBe(
        'done',
      );

      expect(ch.ack).toHaveBeenCalledTimes(1);
      expect(ch.nack).not.toHaveBeenCalled();
    });

    it('rejects the message and swallows the error on failure', async () => {
      const ch = channel();

      await expect(
        settle(contextWith(ch), async () => {
          throw new Error('handler blew up');
        }),
      ).resolves.toBeUndefined();

      expect(ch.nack).toHaveBeenCalledWith(expect.anything(), false, false);
      expect(ch.ack).not.toHaveBeenCalled();
    });
  });
});
