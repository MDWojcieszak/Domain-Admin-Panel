import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { AgentHealthService } from './agent-health.service';

const websocket = () =>
  ({ emitToRoom: jest.fn() }) as unknown as WebsocketGateway;

describe('AgentHealthService', () => {
  let ws: WebsocketGateway;
  let service: AgentHealthService;

  beforeEach(() => {
    jest.useFakeTimers();
    ws = websocket();
    service = new AgentHealthService(ws);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts offline with nothing known', () => {
    const health = service.health();

    expect(health.online).toBe(false);
    expect(health.lastSeenAt).toBeNull();
    expect(health.version).toBeNull();
  });

  it('goes online on the first heartbeat and reports what it was told', () => {
    service.record({
      version: '1.0.0',
      uptimeSeconds: 42,
      containerCount: 9,
      dockerReachable: true,
    });

    expect(service.health()).toMatchObject({
      online: true,
      version: '1.0.0',
      uptimeSeconds: 42,
      containerCount: 9,
      dockerReachable: true,
    });
  });

  it('announces the transition to online exactly once', () => {
    service.record({ version: '1.0.0' });
    service.record({ version: '1.0.0' });

    expect(ws.emitToRoom).toHaveBeenCalledTimes(1);
  });

  it('stays online while beats keep arriving', async () => {
    service.record({});

    jest.advanceTimersByTime(60_000);
    await service.checkLiveness();

    expect(service.health().online).toBe(true);
  });

  it('goes offline after three missed beats and runs its handlers', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.onOffline(handler);
    service.record({});

    jest.advanceTimersByTime(91_000);
    await service.checkLiveness();

    expect(service.health().online).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does nothing when it was never online', async () => {
    const handler = jest.fn();
    service.onOffline(handler);

    jest.advanceTimersByTime(600_000);
    await service.checkLiveness();

    expect(handler).not.toHaveBeenCalled();
  });

  // One broken handler must not stop the others from cleaning up.
  it('keeps running handlers after one throws', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const after = jest.fn().mockResolvedValue(undefined);

    service.onOffline(failing);
    service.onOffline(after);
    service.record({});

    jest.advanceTimersByTime(91_000);
    await service.checkLiveness();

    expect(failing).toHaveBeenCalled();
    expect(after).toHaveBeenCalled();
  });

  it('comes back online after the agent returns', async () => {
    service.record({});
    jest.advanceTimersByTime(91_000);
    await service.checkLiveness();

    service.record({ version: '1.0.1' });

    expect(service.health()).toMatchObject({ online: true, version: '1.0.1' });
  });
});
