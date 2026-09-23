import { BadRequestException } from '@nestjs/common';
import { ApplicationTier, BuildMode } from '@prisma/client';

import {
  ComposeRendererService,
  RenderInput,
} from './compose-renderer.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml') as { load: (input: string) => any };

const input = (overrides: Partial<RenderInput> = {}): RenderInput => ({
  slug: 'photo-gallery-backend',
  tier: ApplicationTier.APPLICATION,
  releaseId: 'rel-1',
  image: 'ghcr.io/mdwojcieszak/photo-gallery-backend',
  version: '0.3.0',
  digest: null,
  spec: { port: 3000 },
  env: {},
  ...overrides,
});

describe('ComposeRendererService', () => {
  let service: ComposeRendererService;

  const renderService = (overrides: Partial<RenderInput> = {}) =>
    yaml.load(service.render(input(overrides)).compose).services.app;

  beforeEach(() => {
    service = new ComposeRendererService();
  });

  describe('structure', () => {
    it('emits services at the top level, as TrueNAS >= 25.10 requires', () => {
      const doc = yaml.load(service.render(input()).compose);

      expect(Object.keys(doc)).toEqual(['services', 'networks']);
      expect(doc.services.app).toBeDefined();
    });

    it('declares the shared network as external', () => {
      const doc = yaml.load(
        service.render(input({ spec: { port: 3000, network: 'homelab' } }))
          .compose,
      );

      expect(doc.networks).toEqual({ homelab: { external: true } });
      expect(doc.services.app.networks).toEqual(['homelab']);
    });

    it('is deterministic for identical input', () => {
      const first = service.render(input());
      const second = service.render(input());

      expect(first.compose).toBe(second.compose);
      expect(first.env).toBe(second.env);
    });
  });

  describe('conventions that cannot be opted out of', () => {
    it('always sets an explicit restart policy', () => {
      expect(renderService().restart).toBe('unless-stopped');
    });

    it('always configures log rotation', () => {
      expect(renderService().logging).toEqual({
        driver: 'json-file',
        options: { 'max-size': '10m', 'max-file': '3' },
      });
    });

    it('always emits the identifying labels', () => {
      const labels = renderService().labels;

      expect(labels['homelab.app']).toBe('photo-gallery-backend');
      expect(labels['homelab.tier']).toBe('APPLICATION');
      expect(labels['homelab.release']).toBe('rel-1');
    });

    it('points env_file at the configured env file', () => {
      expect(renderService().env_file).toEqual(['.env']);
    });
  });

  describe('image pinning', () => {
    it('prefers the digest over the version', () => {
      const svc = renderService({ digest: 'sha256:abc', version: '0.3.0' });

      expect(svc.image).toBe(
        'ghcr.io/mdwojcieszak/photo-gallery-backend@sha256:abc',
      );
    });

    it('falls back to the version when there is no digest', () => {
      expect(renderService().image).toBe(
        'ghcr.io/mdwojcieszak/photo-gallery-backend:0.3.0',
      );
    });

    it('accepts an image reference that already carries a tag', () => {
      const svc = renderService({
        image: 'postgres:15.8-alpine',
        version: null,
        digest: null,
      });

      expect(svc.image).toBe('postgres:15.8-alpine');
    });

    it('rejects an unpinned image rather than defaulting to latest', () => {
      expect(() =>
        service.render(input({ image: 'nginx', version: null, digest: null })),
      ).toThrow(/not pinned/);
    });

    it('rejects a missing image', () => {
      expect(() => service.render(input({ image: null }))).toThrow(
        BadRequestException,
      );
    });

    it('is not confused by a registry port in the host part', () => {
      const svc = renderService({
        image: 'registry.local:5000/app',
        version: '1.2.3',
        digest: null,
      });

      expect(svc.image).toBe('registry.local:5000/app:1.2.3');
    });
  });

  describe('ingress', () => {
    it('emits Traefik labels when a domain is set', () => {
      const labels = renderService({
        spec: { port: 3000, domain: 'api.example.com' },
      }).labels;

      expect(labels['traefik.enable']).toBe('true');
      expect(labels['traefik.http.routers.photo-gallery-backend.rule']).toBe(
        'Host(`api.example.com`)',
      );
      expect(
        labels[
          'traefik.http.services.photo-gallery-backend.loadbalancer.server.port'
        ],
      ).toBe('3000');
    });

    it('emits no Traefik labels without a domain', () => {
      const labels = renderService().labels;

      expect(labels['traefik.enable']).toBeUndefined();
    });

    // §9.4.4 — a router with no target port is a configuration error.
    it('refuses a domain without a port', () => {
      expect(() =>
        service.render(input({ spec: { domain: 'api.example.com' } })),
      ).toThrow(/domain requires port/);
    });

    it('publishes a host port only when asked', () => {
      expect(renderService().ports).toBeUndefined();
      expect(
        renderService({ spec: { port: 3000, publishPort: 8080 } }).ports,
      ).toEqual(['8080:3000']);
    });
  });

  describe('healthcheck', () => {
    it('derives a healthcheck from the health path', () => {
      const healthcheck = renderService({
        spec: { port: 3000, health: '/health' },
      }).healthcheck;

      expect(healthcheck.test).toEqual([
        'CMD-SHELL',
        'wget -q --spider http://127.0.0.1:3000/health || exit 1',
      ]);
      expect(healthcheck.retries).toBe(3);
    });

    it('lets an explicit command override the generated one', () => {
      const healthcheck = renderService({
        spec: {
          port: 3000,
          health: '/health',
          healthCommand: ['pg_isready', '-U', 'admin'],
        },
      }).healthcheck;

      expect(healthcheck.test).toEqual(['CMD', 'pg_isready', '-U', 'admin']);
    });

    it('emits no healthcheck when no health path is configured', () => {
      expect(renderService().healthcheck).toBeUndefined();
    });

    it('rejects a health path that is not absolute', () => {
      expect(() =>
        service.render(input({ spec: { port: 3000, health: 'health' } })),
      ).toThrow(/absolute path/);
    });
  });

  describe('volumes and resources', () => {
    it('renders volumes, marking read-only mounts', () => {
      const svc = renderService({
        spec: {
          port: 3000,
          volumes: [
            { host: '/mnt/VAULT/APPS/gallery', path: '/app/public' },
            { host: '/mnt/VAULT/certs', path: '/certs', readOnly: true },
          ],
        },
      });

      expect(svc.volumes).toEqual([
        '/mnt/VAULT/APPS/gallery:/app/public',
        '/mnt/VAULT/certs:/certs:ro',
      ]);
    });

    it('rejects a relative host path', () => {
      expect(() =>
        service.render(
          input({
            spec: { port: 3000, volumes: [{ host: 'data', path: '/data' }] },
          }),
        ),
      ).toThrow(/absolute path/);
    });

    it('renders resource limits when given', () => {
      const svc = renderService({
        spec: { port: 3000, resources: { memory: '2G', cpus: '2.0' } },
      });

      expect(svc.deploy).toEqual({
        resources: { limits: { memory: '2G', cpus: '2.0' } },
      });
    });

    it('omits the deploy block when no limits are set', () => {
      expect(renderService().deploy).toBeUndefined();
    });
  });

  describe('cross-stack dependencies', () => {
    // Compose cannot express a dependency on a service in another stack, so
    // emitting depends_on would produce a file that fails to start.
    it('records depends as a label and never as depends_on', () => {
      const svc = renderService({
        spec: { port: 3000, depends: ['postgres', 'rabbitmq'] },
      });

      expect(svc.depends_on).toBeUndefined();
      expect(svc.labels['homelab.depends']).toBe('postgres,rabbitmq');
    });
  });

  describe('env file', () => {
    it('writes sorted KEY=value lines and reports the keys', () => {
      const result = service.render(
        input({
          env: { ZED: 'last', ALPHA: 'first', DATABASE_URL: 'postgres://x' },
        }),
      );

      expect(result.env).toBe(
        'ALPHA=first\nDATABASE_URL=postgres://x\nZED=last\n',
      );
      expect(result.envKeys).toEqual(['ALPHA', 'DATABASE_URL', 'ZED']);
    });

    it('renders an empty env file as an empty string', () => {
      expect(service.render(input()).env).toBe('');
    });

    // I3 — resolved values belong in the env file, never in the compose file.
    it('keeps environment values out of the compose file', () => {
      const result = service.render(
        input({ env: { JWT_SECRET: 'super-secret-value' } }),
      );

      expect(result.compose).not.toContain('super-secret-value');
      expect(result.env).toContain('JWT_SECRET=super-secret-value');
    });

    it('rejects an invalid env key', () => {
      expect(() =>
        service.render(input({ env: { 'not-valid': 'x' } })),
      ).toThrow(/Invalid environment key/);
    });

    it('rejects a value containing a line break', () => {
      expect(() =>
        service.render(input({ env: { KEY: 'line1\nline2' } })),
      ).toThrow(/line break/);
    });
  });

  describe('buildMode COMPOSE', () => {
    const composeInput = (spec: Record<string, unknown> = {}) =>
      input({
        buildMode: BuildMode.COMPOSE,
        spec: {
          port: 3000,
          build: { context: '/mnt/VAULT/APPS/src/gallery' },
          ...spec,
        },
      });

    it('emits a build section alongside the image', () => {
      const svc = yaml.load(service.render(composeInput()).compose).services
        .app;

      expect(svc.build).toEqual({ context: '/mnt/VAULT/APPS/src/gallery' });
    });

    // A digest and a build section name two different things; compose would
    // build and then be told to run something else.
    it('tags the build instead of pinning a digest', () => {
      const svc = yaml.load(
        service.render(
          input({
            buildMode: BuildMode.COMPOSE,
            digest: 'sha256:abc',
            version: '0.3.0',
            spec: { port: 3000, build: { context: './src' } },
          }),
        ).compose,
      ).services.app;

      expect(svc.image).toBe(
        'ghcr.io/mdwojcieszak/photo-gallery-backend:0.3.0',
      );
      expect(svc.image).not.toContain('@sha256');
    });

    it('falls back to the slug and latest when nothing is configured', () => {
      const svc = yaml.load(
        service.render(
          input({
            buildMode: BuildMode.COMPOSE,
            image: null,
            version: null,
            spec: { port: 3000, build: { context: './src' } },
          }),
        ).compose,
      ).services.app;

      expect(svc.image).toBe('photo-gallery-backend:latest');
    });

    it('renders dockerfile, target and sorted build args', () => {
      const svc = yaml.load(
        service.render(
          composeInput({
            build: {
              context: './src',
              dockerfile: 'Dockerfile.prod',
              target: 'runner',
              args: { ZED: '1', ALPHA: '2' },
            },
          }),
        ).compose,
      ).services.app;

      expect(svc.build).toEqual({
        context: './src',
        dockerfile: 'Dockerfile.prod',
        target: 'runner',
        args: { ALPHA: '2', ZED: '1' },
      });
      expect(Object.keys(svc.build.args)).toEqual(['ALPHA', 'ZED']);
    });

    it('refuses COMPOSE without a build context', () => {
      expect(() =>
        service.render(
          input({ buildMode: BuildMode.COMPOSE, spec: { port: 3000 } }),
        ),
      ).toThrow(/requires spec.build.context/);
    });

    it('emits no build section for REGISTRY', () => {
      const svc = yaml.load(
        service.render(
          input({
            buildMode: BuildMode.REGISTRY,
            spec: { port: 3000, build: { context: './src' } },
          }),
        ).compose,
      ).services.app;

      expect(svc.build).toBeUndefined();
    });
  });
});
