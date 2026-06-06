/**
 * Declares a message the backend SENDS to a remote server (Backend → Server),
 * placed directly on the event/payload class. Collected at module load into a
 * registry that the AsyncAPI generator reads — so outbound messages are
 * self-documented next to their payload, with no central hand-written list.
 *
 * A payload class may carry several decorators (e.g. PowerServerEvent is sent
 * on both `server.shutdown` and `server.reboot`).
 */
export type OutboundInteraction = 'message' | 'event';

export interface OutboundMessageMeta {
  /** RabbitMQ pattern. May be a template such as `{commandValue}`. */
  pattern: string;
  /** message = request/reply (send), event = fire-and-forget (emit). */
  interaction: OutboundInteraction;
  summary?: string;
  /** AsyncAPI channel parameters for templated patterns. */
  parameters?: Record<
    string,
    { description?: string; schema: Record<string, unknown> }
  >;
}

export interface RegisteredOutboundMessage {
  payload: Function;
  meta: OutboundMessageMeta;
}

const OUTBOUND_MESSAGES: RegisteredOutboundMessage[] = [];

export function OutboundMessage(meta: OutboundMessageMeta): ClassDecorator {
  return (target) => {
    OUTBOUND_MESSAGES.push({ payload: target as unknown as Function, meta });
  };
}

export function getRegisteredOutboundMessages(): ReadonlyArray<RegisteredOutboundMessage> {
  return OUTBOUND_MESSAGES;
}
