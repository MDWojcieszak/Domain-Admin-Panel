import { PassThrough, Readable } from 'stream';

import { streamFileToResponse } from './stream-file.helper';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeRes(overrides: Record<string, unknown> = {}) {
  const res = new PassThrough() as any;
  res.headersSent = false;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  res.destroy = jest.fn();
  Object.assign(res, overrides);
  return res;
}

describe('streamFileToResponse', () => {
  it('does not crash the process when the source errors', async () => {
    const file = new Readable({ read() {} });
    const res = makeRes();

    streamFileToResponse(file, res);
    // Without a listener this would be an unhandled 'error' event — a hard
    // process exit in Node, not a caught exception.
    expect(() => file.emit('error', new Error('EIO'))).not.toThrow();
  });

  it('answers 500 when nothing has been written yet', () => {
    const file = new Readable({ read() {} });
    const res = makeRes();

    streamFileToResponse(file, res);
    file.emit('error', new Error('EIO'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
    expect(res.destroy).not.toHaveBeenCalled();
  });

  it('tears the connection down once the status is already committed', () => {
    const file = new Readable({ read() {} });
    const res = makeRes({ headersSent: true });

    streamFileToResponse(file, res);
    file.emit('error', new Error('EIO'));

    expect(res.destroy).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('releases the file descriptor when the client aborts', () => {
    const file = new Readable({ read() {} });
    const res = makeRes();

    streamFileToResponse(file, res);
    res.emit('close');

    expect(file.destroyed).toBe(true);
  });

  it('pipes the payload through on the happy path', async () => {
    const file = Readable.from([Buffer.from('jpeg-bytes')]);
    const res = makeRes();
    const received: Buffer[] = [];
    res.on('data', (chunk: Buffer) => received.push(chunk));

    streamFileToResponse(file, res);
    await new Promise((resolve) => res.on('end', resolve));

    expect(Buffer.concat(received).toString()).toBe('jpeg-bytes');
  });
});
