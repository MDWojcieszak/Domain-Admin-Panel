import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { Readable } from 'stream';

const logger = new Logger('StreamFile');

/**
 * Pipes a file stream to the HTTP response, with the two failure modes a bare
 * `file.pipe(res)` leaves open:
 *
 *  - **Read failure mid-transfer.** `pipe()` attaches no `'error'` listener to
 *    the *source*, and an `'error'` event with no listener is a hard crash in
 *    Node — one unreadable file on disk takes the whole process down. Because
 *    `existsSync` runs before the stream opens, this is reachable in practice:
 *    a deleted/renamed file, a permissions change, or a flaky mount between the
 *    check and the read.
 *  - **Client abort.** `pipe()` never destroys the source when the destination
 *    goes away, so every cancelled image request (navigation, fast scrolling
 *    through a gallery) leaks a file descriptor until GC gets around to it.
 *
 * Once the first byte is on the wire the status code is already committed, so a
 * late failure can only be signalled by tearing the connection down — the
 * client sees a truncated response instead of a silently corrupt image.
 */
export function streamFileToResponse(file: Readable, res: Response): void {
  // Fires on normal completion too; destroying a finished stream is a no-op.
  res.on('close', () => file.destroy());

  file.on('error', (err) => {
    logger.error(`Failed to stream file: ${err.message}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.status(500).json({
      statusCode: 500,
      message: 'Error reading image',
    });
  });

  file.pipe(res);
}
