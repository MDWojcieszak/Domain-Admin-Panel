import { signMessage } from './message-signature';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AgentSignatureGuard', () => {
  const KEY = 'guard-test-key';
  let AgentSignatureGuard: any;

  beforeAll(async () => {
    process.env.DEPLOY_AGENT_KEY = KEY;
    ({ AgentSignatureGuard } = await import('./agent-signature.guard'));
  });

  const contextFor = (pattern: string, data: unknown) => {
    const channel = { nack: jest.fn(), ack: jest.fn() };
    const message = { content: Buffer.from('') };
    const rmq = {
      getPattern: () => pattern,
      getChannelRef: () => channel,
      getMessage: () => message,
    };
    const context: any = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => rmq, getData: () => data }),
    };
    return { context, channel, message };
  };

  it('lets a message signed by the agent through', () => {
    const data = JSON.parse(
      JSON.stringify(
        signMessage(KEY, 'deploy.git.credentials', { repoId: 'r1' }),
      ),
    );
    const { context, channel } = contextFor('deploy.git.credentials', data);

    expect(new AgentSignatureGuard().canActivate(context)).toBe(true);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('refuses an unsigned request for the git token and drops it without requeue', () => {
    const { context, channel, message } = contextFor('deploy.git.credentials', {
      repoId: 'r1',
    });

    expect(new AgentSignatureGuard().canActivate(context)).toBe(false);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
