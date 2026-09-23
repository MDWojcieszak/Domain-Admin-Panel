import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

/**
 * Manual acknowledgement helpers for the deployment queue (§12.3).
 *
 * The deploy queue runs with `noAck: false`, so every handler has to settle its
 * message explicitly. Nothing here throws: a failure to acknowledge must not
 * turn into a failed request on top of whatever already went wrong.
 */

const logger = new Logger('DeployQueue');

export const ack = (context: RmqContext): void => {
  try {
    context.getChannelRef().ack(context.getMessage());
  } catch (error) {
    logger.warn(
      `Could not acknowledge message: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }
};

/**
 * Rejects a message **without requeueing**.
 *
 * Requeueing a message the handler just failed on produces a poison loop: the
 * same bad payload comes straight back, fails again, and spins until the broker
 * or the log volume gives out. A dropped message is visible in the logs; an
 * infinite loop takes the queue down with it.
 */
export const reject = (context: RmqContext, error: unknown): void => {
  logger.error(
    `Rejecting message: ${
      error instanceof Error ? error.message : 'unknown error'
    }`,
    error instanceof Error ? error.stack : undefined,
  );

  try {
    context.getChannelRef().nack(context.getMessage(), false, false);
  } catch (nackError) {
    logger.warn(
      `Could not reject message: ${
        nackError instanceof Error ? nackError.message : 'unknown error'
      }`,
    );
  }
};

/** Runs a handler, settling the message either way. */
export const settle = async <T>(
  context: RmqContext,
  work: () => Promise<T>,
): Promise<T | undefined> => {
  try {
    const result = await work();
    ack(context);
    return result;
  } catch (error) {
    reject(context, error);
    return undefined;
  }
};
