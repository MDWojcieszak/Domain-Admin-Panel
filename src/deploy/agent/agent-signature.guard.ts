import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

import { config } from '../../config/config';
import { verifyMessage } from './message-signature';
import { reject } from './rmq-ack';

/**
 * Lets through only messages the deploy agent signed. Anyone else who can
 * publish to the deploy queue could otherwise fake a release result, flood the
 * container view — or ask for the git token.
 *
 * Runs before the validation pipe, on the raw payload, so the signature field
 * is still there. A refused message is rejected without requeueing: on a
 * manual-ack queue an unsettled message would come back forever.
 */
@Injectable()
export class AgentSignatureGuard implements CanActivate {
  private readonly logger = new Logger(AgentSignatureGuard.name);
  private readonly key = config().deployAgentKey;

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'rpc') return true;

    const rpc = context.switchToRpc();
    const rmq = rpc.getContext<RmqContext>();
    const pattern = String(rmq.getPattern());
    const problem = verifyMessage(this.key, pattern, rpc.getData());

    if (!problem) return true;

    this.logger.warn(`Refused "${pattern}" from the deploy queue: ${problem}`);
    reject(rmq, new Error(`unauthenticated message: ${problem}`));
    return false;
  }
}
