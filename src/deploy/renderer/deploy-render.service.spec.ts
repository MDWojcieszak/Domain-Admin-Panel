import { AppSourceType, ApplicationTier, BuildMode } from '@prisma/client';

import { InterpolatorService } from '../interpolation/interpolator.service';
import {
  LogRedactionService,
  maskEnvFile,
  REDACTED,
} from '../secrets/log-redaction.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import { ComposeRendererService } from './compose-renderer.service';
import { ComposeSourceService } from './compose-source.service';
import { DeployRenderService } from './deploy-render.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * I3 — a secret's value never leaves the backend except in the .env on the
 * host: not in the API, not in a diff, not in ProcessLog, not in a Release.
 * Real interpolator, renderer and encryption; only the database is mocked.
 */

const crypto = new SecretCryptoService({
  get: () => 'test-deploy-secret-key',
} as any);

const OWN_SECRET = 'app-own-db-password-123';
const GLOBAL_SECRET = 'global-smtp-password-456';

const application = (spec: Record<string, unknown> = { port: 3000 }) => ({
  id: 'app1',
  slug: 'photo-gallery-backend',
  isDeleted: false,
  sourceType: AppSourceType.RENDERED,
  tier: ApplicationTier.APPLICATION,
  buildMode: BuildMode.REGISTRY,
  image: 'ghcr.io/mdwojcieszak/photo-gallery-backend:1.0.0',
  spec,
  currentRelease: null,
  envs: [
    // typed in directly, encrypted at rest
    { key: 'DB_PASSWORD', value: crypto.encrypt(OWN_SECRET), isSecret: true },
    // not secret itself, but built from a secret global variable
    {
      key: 'SMTP_URL',
      value: 'smtp://mailer:[[SMTP_PASSWORD]]@mail.local',
      isSecret: false,
    },
    { key: 'NODE_ENV', value: 'production', isSecret: false },
  ],
});

function makeService(app = application()) {
  const prisma: any = {
    application: { findFirst: jest.fn().mockResolvedValue(app) },
    applicationEnv: { findMany: jest.fn().mockResolvedValue(app.envs) },
    variable: {
      findMany: jest.fn().mockResolvedValue([
        {
          key: 'SMTP_PASSWORD',
          value: crypto.encrypt(GLOBAL_SECRET),
          isSecret: true,
        },
      ]),
    },
  };
  return new DeployRenderService(
    prisma,
    new ComposeRendererService(),
    new InterpolatorService(),
    crypto,
    new ComposeSourceService(),
  );
}

describe('DeployRenderService — secrets (I3)', () => {
  it('never returns a secret value in the preview', async () => {
    const preview = await makeService().preview('app1');
    const everything = JSON.stringify(preview);

    expect(everything).not.toContain(OWN_SECRET);
    expect(everything).not.toContain(GLOBAL_SECRET);
    expect(preview).not.toHaveProperty('secretValues');
    expect(preview).not.toHaveProperty('secretKeys');

    // the panel still sees every key, and non-secret values as they are
    expect(preview.env).toContain(`DB_PASSWORD=${REDACTED}`);
    expect(preview.env).toContain(
      `SMTP_URL=smtp://mailer:${REDACTED}@mail.local`,
    );
    expect(preview.env).toContain('NODE_ENV=production');
  });

  it('hands the deployment path the real values, and every secret to redact', async () => {
    const full = await makeService().renderForDeploy('app1');

    // the agent must write the real file
    expect(full.env).toContain(`DB_PASSWORD=${OWN_SECRET}`);
    // the application's own secret was missing from redaction before
    expect(full.secretValues).toEqual(
      expect.arrayContaining([OWN_SECRET, GLOBAL_SECRET]),
    );
  });

  it('redacts the application’s own secret from deployment logs', async () => {
    const full = await makeService().renderForDeploy('app1');
    const redaction = new LogRedactionService();
    redaction.register('p1', full.secretValues);

    expect(
      redaction.redact('p1', `DB_PASSWORD=${OWN_SECRET} SMTP ${GLOBAL_SECRET}`),
    ).toBe(`DB_PASSWORD=${REDACTED} SMTP ${REDACTED}`);
  });

  it('refuses a secret in the spec, which would land in compose.yaml', async () => {
    const service = makeService(
      application({
        port: 3000,
        healthCommand: ['CMD', 'redis-cli', '-a', '[[DB_PASSWORD]]', 'ping'],
      }),
    );

    await expect(service.preview('app1')).rejects.toThrow(
      /DB_PASSWORD cannot be used in the spec/,
    );
  });

  it('still allows non-secret variables in the spec', async () => {
    const service = makeService(
      application({ port: 3000, health: '/health?env=[[NODE_ENV]]' }),
    );
    await expect(service.preview('app1')).resolves.toMatchObject({
      missingKeys: [],
    });
  });
});

describe('maskEnvFile', () => {
  it('masks secret keys whole and secret fragments elsewhere, never key names', () => {
    expect(
      maskEnvFile(
        'API_KEY=abc\nURL=https://u:abc@h\nNOTE=abcdef',
        new Set(['API_KEY']),
        ['abc'],
      ),
    ).toBe(
      `API_KEY=${REDACTED}\nURL=https://u:${REDACTED}@h\nNOTE=${REDACTED}def`,
    );
  });
});

describe('DeployRenderService — own compose file', () => {
  const composeApp = (compose: string, envs = application().envs) => ({
    ...application(),
    sourceType: AppSourceType.COMPOSE,
    image: null,
    compose,
    envs,
    gitRepo: null,
  });

  it('labels the services and masks the secrets the file reads', async () => {
    const service = makeService(
      composeApp(
        'services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: ${DB_PASSWORD}\n',
      ) as any,
    );

    const preview = await service.preview('app1');

    expect(preview.missingKeys).toEqual([]);
    expect(preview.compose).toContain('homelab.app: photo-gallery-backend');
    expect(preview.compose).toContain('${DB_PASSWORD}');
    expect(JSON.stringify(preview)).not.toContain(OWN_SECRET);
    expect(preview.env).toContain(`DB_PASSWORD=${REDACTED}`);
  });

  it('blocks a deployment when the file reads a variable nothing defines (I6)', async () => {
    const service = makeService(
      composeApp(
        'services:\n  app:\n    image: x\n    environment:\n      A: ${UNDEFINED_ONE}\n      B: ${WITH_DEFAULT:-ok}\n',
      ) as any,
    );

    const preview = await service.preview('app1');

    expect(preview.missingKeys).toEqual(['UNDEFINED_ONE']);
    expect(preview.compose).toBeNull();
  });

  it('refuses a secret global variable written into the file', async () => {
    const service = makeService(
      composeApp(
        'services:\n  app:\n    image: x\n    command: ["run", "[[SMTP_PASSWORD]]"]\n',
      ) as any,
    );

    await expect(service.preview('app1')).rejects.toThrow(
      /SMTP_PASSWORD cannot be used in the compose file/,
    );
  });
});
