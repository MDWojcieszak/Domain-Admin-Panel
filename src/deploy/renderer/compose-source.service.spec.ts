import { BadRequestException } from '@nestjs/common';
import { ApplicationTier, BuildMode } from '@prisma/client';
import * as yaml from 'js-yaml';

import { ComposeSourceService } from './compose-source.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const service = new ComposeSourceService();
const pasted = { envFilePath: '.env' };
const takeover = { envFilePath: '.env', workingDir: '/mnt/VAULT/APPS/immich' };

const load = (text: string) => yaml.load(text) as any;

describe('ComposeSourceService', () => {
  describe('normalise', () => {
    it('keeps a clean file byte for byte, comments included', () => {
      const text = [
        '# my stack',
        'services:',
        '  app:',
        '    image: nginx:1.27',
        '    environment:',
        '      DB_PASSWORD: ${DB_PASSWORD}',
        '    volumes:',
        '      - /mnt/VAULT/APPS/app/data:/data',
        '',
      ].join('\n');

      const result = service.normalise(text, pasted);

      expect(result.compose).toBe(text);
      expect(result.extracted).toEqual([]);
      expect(result.buildMode).toBe(BuildMode.NONE);
    });

    it('moves inline secrets into entries and reads them back as ${KEY} (I3)', () => {
      const result = service.normalise(
        [
          'services:',
          '  db:',
          '    image: postgres:16',
          '    environment:',
          '      POSTGRES_PASSWORD: hunter22secret',
          '      POSTGRES_DB: app',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "PGPASSWORD=hunter22secret pg_isready"]',
          '  app:',
          '    image: app:1',
          '    environment:',
          '      - API_TOKEN=tok-123456',
        ].join('\n'),
        pasted,
      );

      expect(result.extracted).toEqual(
        expect.arrayContaining([
          { key: 'POSTGRES_PASSWORD', value: 'hunter22secret' },
          { key: 'API_TOKEN', value: 'tok-123456' },
        ]),
      );
      expect(result.compose).not.toContain('hunter22secret');
      expect(result.compose).not.toContain('tok-123456');

      const doc = load(result.compose);
      expect(doc.services.db.environment.POSTGRES_PASSWORD).toBe(
        '${POSTGRES_PASSWORD}',
      );
      expect(doc.services.db.environment.POSTGRES_DB).toBe('app');
      expect(doc.services.db.healthcheck.test[1]).toContain(
        '${POSTGRES_PASSWORD}',
      );
      expect(doc.services.app.environment).toEqual(['API_TOKEN=${API_TOKEN}']);
    });

    it('prefixes the service when one name holds two different secrets', () => {
      const result = service.normalise(
        [
          'services:',
          '  a:',
          '    image: x',
          '    environment: { DB_PASSWORD: first-one }',
          '  b:',
          '    image: y',
          '    environment: { DB_PASSWORD: second-one }',
        ].join('\n'),
        pasted,
      );

      expect(result.extracted.map((e) => e.key).sort()).toEqual([
        'A_DB_PASSWORD',
        'B_DB_PASSWORD',
      ]);
    });

    it('refuses a relative path in a pasted file — it would land in the repo', () => {
      expect(() =>
        service.normalise(
          'services:\n  app:\n    image: x\n    volumes: ["./data:/data"]\n',
          pasted,
        ),
      ).toThrow(/relative path "\.\/data"/);
    });

    it('allows the env file the agent writes, refuses any other relative one', () => {
      expect(() =>
        service.normalise(
          'services:\n  app:\n    image: x\n    env_file: .env\n',
          pasted,
        ),
      ).not.toThrow();
      expect(() =>
        service.normalise(
          'services:\n  app:\n    image: x\n    env_file: ./other.env\n',
          pasted,
        ),
      ).toThrow(BadRequestException);
    });

    it('resolves relative paths against the old directory on takeover', () => {
      const result = service.normalise(
        [
          'services:',
          '  server:',
          '    build: ./server',
          '    env_file: .env',
          '    volumes:',
          '      - ./library:/usr/src/app/upload',
          '      - model-cache:/cache',
          '      - type: bind',
          '        source: ./config',
          '        target: /config',
          'volumes:',
          '  model-cache: {}',
        ].join('\n'),
        takeover,
      );

      const server = load(result.compose).services.server;
      expect(server.volumes[0]).toBe(
        '/mnt/VAULT/APPS/immich/library:/usr/src/app/upload',
      );
      // a named volume is not a path
      expect(server.volumes[1]).toBe('model-cache:/cache');
      expect(server.volumes[2].source).toBe('/mnt/VAULT/APPS/immich/config');
      expect(server.build).toBe('/mnt/VAULT/APPS/immich/server');
      // the old .env stays where it is and is still read
      expect(server.env_file).toBe('/mnt/VAULT/APPS/immich/.env');
      expect(result.buildMode).toBe(BuildMode.COMPOSE);
      expect(result.notes.length).toBeGreaterThan(0);
    });

    it('reports that comments were lost when the file had to be rewritten', () => {
      const result = service.normalise(
        '# note\nservices:\n  app:\n    image: x\n    environment: { SECRET_KEY: abcdefgh }\n',
        pasted,
      );
      expect(result.notes.join(' ')).toMatch(/comments/);
    });

    it('rejects something that is not a compose file', () => {
      expect(() => service.normalise('just: text', pasted)).toThrow(
        /no services/,
      );
      expect(() => service.normalise('services: [', pasted)).toThrow(
        /not valid YAML/,
      );
    });
  });

  describe('paths built from variables', () => {
    it('leaves them to compose and says so, pasted or taken over', () => {
      const text = [
        'services:',
        '  web-app:',
        '    build:',
        '      context: ${APP_CONTEXT:-.}',
        '      dockerfile: Dockerfile',
        '    ports:',
        "      - '7090:80'",
        '',
      ].join('\n');

      for (const options of [pasted, takeover]) {
        const result = service.normalise(text, options);
        expect(result.compose).toBe(text);
        expect(result.buildMode).toBe(BuildMode.COMPOSE);
        expect(result.notes.join(' ')).toMatch(/built from a variable/);
      }
    });
  });

  describe('referencedVariables', () => {
    it('finds ${VAR} and $VAR, honours defaults, ignores the $$ escape', () => {
      const refs = service.referencedVariables(
        'a: ${A}\nb: ${B:-x}\nc: $C\nd: $$NOT\ne: ${E:?required}\n',
      );
      expect(refs).toEqual(
        expect.arrayContaining([
          { key: 'A', hasDefault: false },
          { key: 'B', hasDefault: true },
          { key: 'C', hasDefault: false },
          { key: 'E', hasDefault: false },
        ]),
      );
      expect(refs.map((r) => r.key)).not.toContain('NOT');
    });
  });

  describe('render', () => {
    it('adds the identifying labels to every service, keeping its own', () => {
      const out = load(
        service.render(
          [
            'services:',
            '  app:',
            '    image: x',
            '    labels: ["traefik.enable=true"]',
            '  worker:',
            '    image: y',
          ].join('\n'),
          {
            slug: 'immich',
            tier: ApplicationTier.APPLICATION,
            releaseId: 'r1',
          },
        ),
      );

      expect(out.services.app.labels).toEqual({
        'traefik.enable': 'true',
        'homelab.app': 'immich',
        'homelab.tier': 'APPLICATION',
        'homelab.release': 'r1',
      });
      expect(out.services.worker.labels['homelab.app']).toBe('immich');
    });
  });
});

describe('ComposeSourceService — a file kept for a git clone', () => {
  const service = new ComposeSourceService();
  const inClone = { envFilePath: '.env', inClone: true };

  it('keeps relative build contexts: they mean the repository code', () => {
    const text =
      'services:\n  app:\n    build: ./server\n    env_file: ./config/app.env\n';
    expect(service.normalise(text, inClone).compose).toBe(text);
  });

  it('still refuses a relative volume: a reclone would delete the data', () => {
    expect(() =>
      service.normalise(
        'services:\n  app:\n    image: x\n    volumes: ["./data:/data"]\n',
        inClone,
      ),
    ).toThrow(/inside its git clone/);
  });
});
