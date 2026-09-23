import { BadRequestException, Injectable } from '@nestjs/common';

import { AppSpec } from './app-spec';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml') as { load: (input: string) => unknown };

/**
 * Turns an existing compose file into an AppSpec, so a stack adopted with
 * `sourceType: HOST` can be converted to `RENDERED` (§8.5).
 *
 * Best-effort by nature. The real risk is not a wrong mapping — the diff shows
 * those — but **silent loss**: a `cap_add` or `network_mode` that the renderer
 * cannot express would simply disappear, and the application would come back up
 * subtly broken. So anything not understood is reported loudly and the operator
 * decides, rather than being quietly dropped.
 */

export interface ImportedEnv {
  key: string;
  /** Null for anything that looks like a secret — those are never imported. */
  value: string | null;
  isSecret: boolean;
}

export interface ImportResult {
  serviceName: string;
  image: string | null;
  spec: Partial<AppSpec>;
  env: ImportedEnv[];
  /** Everything the operator has to look at before converting. */
  warnings: string[];
}

/** Keys the renderer can reproduce. Anything else is reported as a loss. */
const SUPPORTED_SERVICE_KEYS = new Set([
  'image',
  'build',
  'ports',
  'volumes',
  'environment',
  'env_file',
  'depends_on',
  'healthcheck',
  'labels',
  'networks',
  'deploy',
  'restart',
  'logging',
  'container_name',
  'command',
]);

/** Values under these names are never imported, whatever they contain. */
const SECRET_KEY_PATTERN = /PASS|SECRET|TOKEN|KEY|CREDENTIAL|PRIVATE/i;

const TRAEFIK_HOST = /Host\(`([^`]+)`\)/;

@Injectable()
export class ComposeImporterService {
  import(compose: string, projectName?: string): ImportResult {
    const doc = this.parse(compose);
    const services = doc.services ?? {};
    const names = Object.keys(services);

    if (names.length === 0) {
      throw new BadRequestException('The compose file declares no services.');
    }

    const warnings: string[] = [];
    const serviceName = this.pickService(
      names,
      services,
      projectName,
      warnings,
    );
    const service = services[serviceName] as Record<string, unknown>;

    this.warnUnsupported(service, serviceName, warnings);
    this.warnTopLevel(doc, warnings);

    const ports = this.readPorts(service, warnings);
    const spec: Partial<AppSpec> = {
      ...ports,
      volumes: this.readVolumes(service, warnings),
      depends: this.readDepends(service),
      resources: this.readResources(service),
      network: this.readNetwork(service),
      domain: this.readDomain(service),
      healthCommand: this.readHealthCommand(service, warnings),
      projectName,
    };

    return {
      serviceName,
      image: typeof service.image === 'string' ? service.image : null,
      spec: Object.fromEntries(
        Object.entries(spec).filter(([, v]) => v !== undefined),
      ),
      env: this.readEnv(service, warnings),
      warnings,
    };
  }

  private parse(compose: string): {
    services?: Record<string, unknown>;
    [key: string]: unknown;
  } {
    let doc: unknown;
    try {
      doc = yaml.load(compose);
    } catch (error) {
      throw new BadRequestException(
        `Could not parse the compose file: ${
          error instanceof Error ? error.message : 'invalid YAML'
        }`,
      );
    }

    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      throw new BadRequestException('The compose file is not a YAML mapping.');
    }

    return doc as { services?: Record<string, unknown> };
  }

  /**
   * The renderer emits a single service, so a multi-service stack loses
   * everything but one. That is the loudest possible warning rather than a
   * silent choice.
   */
  private pickService(
    names: string[],
    services: Record<string, unknown>,
    projectName: string | undefined,
    warnings: string[],
  ): string {
    if (names.length === 1) return names[0];

    const byName =
      names.find((n) => n === 'app') ??
      names.find((n) => projectName && n === projectName) ??
      names.find((n) => {
        const svc = services[n] as Record<string, unknown>;
        return svc?.ports !== undefined || svc?.healthcheck !== undefined;
      }) ??
      names[0];

    warnings.push(
      `This stack has ${names.length} services (${names.join(', ')}). The renderer ` +
        `emits one, so converting keeps "${byName}" and DROPS the rest. Split them ` +
        'into separate applications instead, or keep this stack as HOST.',
    );

    return byName;
  }

  private warnUnsupported(
    service: Record<string, unknown>,
    serviceName: string,
    warnings: string[],
  ): void {
    const unsupported = Object.keys(service).filter(
      (key) => !SUPPORTED_SERVICE_KEYS.has(key),
    );

    if (unsupported.length) {
      warnings.push(
        `"${serviceName}" uses settings the renderer cannot express and which ` +
          `would be LOST: ${unsupported.join(', ')}.`,
      );
    }
  }

  private warnTopLevel(doc: Record<string, unknown>, warnings: string[]): void {
    if (doc.volumes) {
      warnings.push(
        'Named volumes are declared at the top level. The renderer only emits ' +
          'host path mounts, so these would be lost — map them to host paths first.',
      );
    }
    if (doc.configs || doc.secrets) {
      warnings.push(
        'Compose configs/secrets are declared and are not supported; use ' +
          'application env entries instead.',
      );
    }
  }

  private readPorts(
    service: Record<string, unknown>,
    warnings: string[],
  ): Partial<AppSpec> {
    const ports = service.ports;
    if (!Array.isArray(ports) || ports.length === 0) return {};

    if (ports.length > 1) {
      warnings.push(
        `Only the first of ${ports.length} published ports is kept; the renderer ` +
          'exposes one port per application.',
      );
    }

    const entry = ports[0];
    if (typeof entry !== 'string') {
      warnings.push('Long-form port mappings are not imported.');
      return {};
    }

    // "8080:3000", "127.0.0.1:8080:3000" or "3000"
    const parts = entry.split(':');
    const container = Number(parts[parts.length - 1]?.split('/')[0]);
    const published = parts.length > 1 ? Number(parts[parts.length - 2]) : NaN;

    if (!Number.isInteger(container)) return {};

    return {
      port: container,
      ...(Number.isInteger(published) ? { publishPort: published } : {}),
    };
  }

  private readVolumes(
    service: Record<string, unknown>,
    warnings: string[],
  ): AppSpec['volumes'] {
    const volumes = service.volumes;
    if (!Array.isArray(volumes)) return undefined;

    const result: NonNullable<AppSpec['volumes']> = [];

    for (const entry of volumes) {
      if (typeof entry !== 'string') {
        warnings.push('A long-form volume was skipped.');
        continue;
      }

      const [host, path, mode] = entry.split(':');
      if (!host?.startsWith('/')) {
        // A named volume, not a host path — the renderer has no way to express it.
        warnings.push(`Volume "${entry}" is not a host path and was skipped.`);
        continue;
      }

      result.push({ host, path, readOnly: mode === 'ro' });
    }

    return result.length ? result : undefined;
  }

  private readDepends(service: Record<string, unknown>): string[] | undefined {
    const depends = service.depends_on;

    if (Array.isArray(depends)) return depends.map(String);
    if (depends && typeof depends === 'object') return Object.keys(depends);

    return undefined;
  }

  private readResources(
    service: Record<string, unknown>,
  ): AppSpec['resources'] {
    const limits = (service.deploy as Record<string, unknown>)?.[
      'resources'
    ] as Record<string, Record<string, string>> | undefined;

    const memory = limits?.limits?.memory;
    const cpus = limits?.limits?.cpus;

    return memory || cpus ? { memory, cpus } : undefined;
  }

  private readNetwork(service: Record<string, unknown>): string | undefined {
    const networks = service.networks;

    if (Array.isArray(networks) && typeof networks[0] === 'string') {
      return networks[0];
    }
    if (networks && typeof networks === 'object') {
      return Object.keys(networks)[0];
    }

    return undefined;
  }

  private readDomain(service: Record<string, unknown>): string | undefined {
    const labels = this.labelMap(service);

    for (const [key, value] of Object.entries(labels)) {
      if (!key.includes('.rule')) continue;

      const match = TRAEFIK_HOST.exec(value);
      if (match) return match[1];
    }

    return undefined;
  }

  private readHealthCommand(
    service: Record<string, unknown>,
    warnings: string[],
  ): string[] | undefined {
    const healthcheck = service.healthcheck as
      | Record<string, unknown>
      | undefined;
    const test = healthcheck?.test;

    if (!test) return undefined;

    if (typeof test === 'string') return ['CMD-SHELL', test];
    if (Array.isArray(test)) {
      // Drop the CMD / CMD-SHELL prefix; the renderer adds its own.
      const [first, ...rest] = test.map(String);
      return first === 'CMD' || first === 'CMD-SHELL' ? rest : test.map(String);
    }

    warnings.push('The healthcheck could not be imported and was skipped.');
    return undefined;
  }

  /**
   * Env values are imported, except anything whose NAME looks like a secret —
   * those come back with a null value to be filled in. Importing them would
   * move secrets into the database through a path that never passes through
   * encryption, and would preserve values the operator may have forgotten
   * about (§8.5).
   */
  private readEnv(
    service: Record<string, unknown>,
    warnings: string[],
  ): ImportedEnv[] {
    const environment = service.environment;
    const entries: [string, string][] = [];

    if (Array.isArray(environment)) {
      for (const entry of environment) {
        const [key, ...rest] = String(entry).split('=');
        entries.push([key, rest.join('=')]);
      }
    } else if (environment && typeof environment === 'object') {
      for (const [key, value] of Object.entries(
        environment as Record<string, unknown>,
      )) {
        entries.push([key, value === null ? '' : String(value)]);
      }
    }

    if (service.env_file) {
      warnings.push(
        'An env_file is referenced. Its contents are not readable from here — ' +
          'add those variables to the application before converting.',
      );
    }

    return entries.map(([key, value]) => {
      const isSecret = SECRET_KEY_PATTERN.test(key);

      return { key, value: isSecret ? null : value, isSecret };
    });
  }

  private labelMap(service: Record<string, unknown>): Record<string, string> {
    const labels = service.labels;

    if (Array.isArray(labels)) {
      return Object.fromEntries(
        labels.map((entry) => {
          const [key, ...rest] = String(entry).split('=');
          return [key, rest.join('=')];
        }),
      );
    }

    if (labels && typeof labels === 'object') {
      return Object.fromEntries(
        Object.entries(labels as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      );
    }

    return {};
  }
}
