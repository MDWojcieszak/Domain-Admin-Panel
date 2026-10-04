import { ClientProxyFactory } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

import { ServerOutboundMessagingService } from './server-outbound-messaging.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const refused = () =>
  Object.assign(new Error('connect ECONNREFUSED 192.168.1.200:5672'), {
    code: 'ECONNREFUSED',
  });

describe('ServerOutboundMessagingService', () => {
  let create: jest.SpyInstance;
  const make = () =>
    new ServerOutboundMessagingService(
      {} as any,
      { get: () => 'amqp://broker' } as any,
    );

  afterEach(() => create.mockRestore());

  it('replaces a client that failed to connect — the broker was still starting', async () => {
    const broken = {
      emit: jest.fn(() => throwError(refused)),
      close: jest.fn(),
    };
    const healthy = { emit: jest.fn(() => of(undefined)), close: jest.fn() };
    create = jest
      .spyOn(ClientProxyFactory, 'create')
      .mockReturnValueOnce(broken as any)
      .mockReturnValueOnce(healthy as any);

    await make().emitToQueue('deploy-agent.commands', 'deploy.execute', {
      a: 1,
    });

    expect(broken.close).toHaveBeenCalled();
    expect(healthy.emit).toHaveBeenCalledWith('deploy.execute', { a: 1 });
  });

  it('reports a broker that stays unreachable instead of losing the message silently', async () => {
    create = jest
      .spyOn(ClientProxyFactory, 'create')
      .mockImplementation(
        () => ({ emit: () => throwError(refused), close: jest.fn() }) as any,
      );

    await expect(
      make().emitToQueue('deploy-agent.commands', 'deploy.execute', {}),
    ).rejects.toThrow(/ECONNREFUSED/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error the receiver sent back — the command did arrive', async () => {
    const client = {
      send: jest.fn(() =>
        throwError(() => ({ status: 'error', message: 'refused by agent' })),
      ),
      close: jest.fn(),
    };
    create = jest
      .spyOn(ClientProxyFactory, 'create')
      .mockReturnValue(client as any);

    await expect(
      make().sendToQueue('deploy-agent.commands', 'stack.action', {}),
    ).rejects.toMatchObject({ message: 'refused by agent' });
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.close).not.toHaveBeenCalled();
  });
});
