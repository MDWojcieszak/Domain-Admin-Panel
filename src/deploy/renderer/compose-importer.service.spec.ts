import { BadRequestException } from '@nestjs/common';

import { ComposeImporterService } from './compose-importer.service';

const compose = (body: string) => `services:\n${body}`;

describe('ComposeImporterService', () => {
  let service: ComposeImporterService;

  beforeEach(() => {
    service = new ComposeImporterService();
  });

  describe('parsing', () => {
    it('rejects invalid YAML', () => {
      expect(() => service.import('services: [unclosed')).toThrow(
        BadRequestException,
      );
    });

    it('rejects a file with no services', () => {
      expect(() => service.import('version: "3"')).toThrow(/no services/);
    });
  });

  describe('single service', () => {
    const result = () =>
      new ComposeImporterService().import(
        compose(`
  app:
    image: ghcr.io/owner/app:1.2.3
    ports:
      - "8080:3000"
    volumes:
      - /mnt/VAULT/data:/data
      - /mnt/VAULT/certs:/certs:ro
    depends_on:
      - postgres
    networks:
      - homelab
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
    labels:
      - traefik.http.routers.app.rule=Host(\`api.example.com\`)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    environment:
      LOG_LEVEL: info
      DB_PASSWORD: hunter2
`),
      );

    it('picks the only service', () => {
      expect(result().serviceName).toBe('app');
      expect(result().image).toBe('ghcr.io/owner/app:1.2.3');
    });

    it('imports the published and container ports', () => {
      expect(result().spec).toMatchObject({ port: 3000, publishPort: 8080 });
    });

    it('imports host volumes with their read-only flag', () => {
      expect(result().spec.volumes).toEqual([
        { host: '/mnt/VAULT/data', path: '/data', readOnly: false },
        { host: '/mnt/VAULT/certs', path: '/certs', readOnly: true },
      ]);
    });

    it('imports dependencies, network and resource limits', () => {
      expect(result().spec).toMatchObject({
        depends: ['postgres'],
        network: 'homelab',
        resources: { memory: '2G', cpus: '2.0' },
      });
    });

    it('extracts the hostname from a Traefik rule label', () => {
      expect(result().spec.domain).toBe('api.example.com');
    });

    it('strips the CMD prefix from the healthcheck', () => {
      expect(result().spec.healthCommand).toEqual([
        'curl',
        '-f',
        'http://localhost:3000/health',
      ]);
    });

    it('produces no warnings for a fully supported service', () => {
      expect(result().warnings).toEqual([]);
    });
  });

  describe('environment', () => {
    // §8.5 — importing a secret would move it into the database through a path
    // that never passes encryption, and preserve a value nobody remembers.
    it('imports ordinary values but blanks anything that looks secret', () => {
      const { env } = service.import(
        compose(`
  app:
    image: nginx:1.27
    environment:
      LOG_LEVEL: info
      DB_PASSWORD: hunter2
      JWT_SECRET: abc
      API_TOKEN: xyz
      PRIVATE_KEY: pem
`),
      );

      expect(env).toEqual([
        { key: 'LOG_LEVEL', value: 'info', isSecret: false },
        { key: 'DB_PASSWORD', value: null, isSecret: true },
        { key: 'JWT_SECRET', value: null, isSecret: true },
        { key: 'API_TOKEN', value: null, isSecret: true },
        { key: 'PRIVATE_KEY', value: null, isSecret: true },
      ]);
    });

    it('handles the list form of environment', () => {
      const { env } = service.import(
        compose(`
  app:
    image: nginx:1.27
    environment:
      - LOG_LEVEL=debug
      - DATABASE_URL=postgres://u:p@h/db
`),
      );

      expect(env).toEqual([
        { key: 'LOG_LEVEL', value: 'debug', isSecret: false },
        {
          key: 'DATABASE_URL',
          value: 'postgres://u:p@h/db',
          isSecret: false,
        },
      ]);
    });

    it('warns that an env_file cannot be read from here', () => {
      const { warnings } = service.import(
        compose(`
  app:
    image: nginx:1.27
    env_file: [.env]
`),
      );

      expect(warnings.join(' ')).toMatch(/env_file/);
    });
  });

  describe('loss warnings', () => {
    // The renderer emits one service, so the rest would vanish silently.
    it('warns loudly about a multi-service stack', () => {
      const { serviceName, warnings } = service.import(
        compose(`
  app:
    image: nginx:1.27
    ports: ["80:80"]
  worker:
    image: nginx:1.27
  cache:
    image: redis:7
`),
      );

      expect(serviceName).toBe('app');
      expect(warnings.join(' ')).toMatch(/3 services/);
      expect(warnings.join(' ')).toMatch(/DROPS the rest/);
    });

    it('warns about settings the renderer cannot express', () => {
      const { warnings } = service.import(
        compose(`
  app:
    image: nginx:1.27
    cap_add: [NET_ADMIN]
    privileged: true
    network_mode: host
`),
      );

      const text = warnings.join(' ');
      expect(text).toMatch(/cap_add/);
      expect(text).toMatch(/privileged/);
      expect(text).toMatch(/network_mode/);
      expect(text).toMatch(/LOST/);
    });

    it('warns about named volumes, which have no host path', () => {
      const { spec, warnings } = service.import(`
services:
  app:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
`);

      expect(spec.volumes).toBeUndefined();
      expect(warnings.join(' ')).toMatch(/Named volumes/);
      expect(warnings.join(' ')).toMatch(/not a host path/);
    });

    it('warns when more than one port is published', () => {
      const { spec, warnings } = service.import(
        compose(`
  app:
    image: nginx:1.27
    ports:
      - "80:80"
      - "443:443"
`),
      );

      expect(spec.port).toBe(80);
      expect(warnings.join(' ')).toMatch(/Only the first of 2/);
    });

    it('warns about compose secrets and configs', () => {
      const { warnings } = service.import(`
services:
  app:
    image: nginx:1.27
secrets:
  db_password:
    file: ./pw.txt
`);

      expect(warnings.join(' ')).toMatch(/configs\/secrets/);
    });
  });

  describe('port parsing', () => {
    it.each([
      ['"3000"', 3000, undefined],
      ['"8080:3000"', 3000, 8080],
      ['"127.0.0.1:8080:3000"', 3000, 8080],
      ['"8080:3000/tcp"', 3000, 8080],
    ])('parses %s', (entry, port, publishPort) => {
      const { spec } = service.import(
        compose(`
  app:
    image: nginx:1.27
    ports: [${entry}]
`),
      );

      expect(spec.port).toBe(port);
      expect(spec.publishPort).toBe(publishPort);
    });
  });
});
