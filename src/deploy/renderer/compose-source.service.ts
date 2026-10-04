import { BadRequestException, Injectable } from '@nestjs/common';
import { ApplicationTier, BuildMode } from '@prisma/client';
import * as yaml from 'js-yaml';
import * as path from 'node:path';

import { HOMELAB_LABELS } from '../discovery/container-classifier';
import { SECRET_KEY_PATTERN } from './compose-importer.service';

/**
 * Applications that bring their own compose file (`sourceType: COMPOSE`) —
 * pasted into the panel, or taken over verbatim from a stack running on the
 * host.
 *
 * The file is kept as the operator wrote it, with two exceptions made on save,
 * both because the file is stored with every release and committed to the
 * homelab repository:
 *
 * - **Inline secrets leave the file.** A password typed into `environment:`
 *   becomes an encrypted env entry and the file says `${KEY}` instead, which
 *   compose fills from the `.env` the agent writes next to it (I3).
 * - **Relative paths are resolved** when a stack is taken over: the file moves
 *   from the stack's own directory into the homelab repository, and a `./data`
 *   left relative would quietly point at an empty directory there — or, worse,
 *   put the application's data inside a git repository.
 *
 * Anything changed is reported, so nothing is rewritten silently.
 */

/** Below this a value is too generic to search-and-replace in other fields. */
const MIN_REPLACEABLE_SECRET = 6;

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `${VAR}`, `${VAR:-default}`, `$VAR` — but not the `$$` escape. */
const COMPOSE_VARIABLE =
  /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])[^}]*)?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

type ComposeDoc = {
  services?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export interface ExtractedSecret {
  key: string;
  value: string;
}

export interface NormalisedCompose {
  /** What is stored: secrets replaced by `${KEY}`, paths absolute. */
  compose: string;
  /** Values moved out of the file, to be stored encrypted. */
  extracted: ExtractedSecret[];
  /** Everything that was changed or is worth knowing, in plain words. */
  notes: string[];
  /** COMPOSE when any service builds, NONE otherwise (nothing to pull from CI). */
  buildMode: BuildMode;
}

export interface NormaliseOptions {
  /**
   * The directory the file came from, when taking over a running stack.
   * Relative paths are resolved against it; without it they are refused.
   */
  workingDir?: string;
  /** Env file the agent writes next to the compose file. */
  envFilePath: string;
  /**
   * The file runs from a git clone (the panel keeps it, the repository has
   * the code). Relative build contexts and env files then mean the
   * repository's, and are kept; a relative volume is still refused.
   */
  inClone?: boolean;
}

export interface ComposeRenderInput {
  slug: string;
  tier: ApplicationTier;
  releaseId: string;
}

@Injectable()
export class ComposeSourceService {
  /**
   * Prepares a compose file for storage. Throws on anything that cannot be
   * deployed safely; everything else is fixed and reported.
   */
  normalise(text: string, options: NormaliseOptions): NormalisedCompose {
    const doc = this.parse(text);
    const notes: string[] = [];
    let changed = false;

    const paths = this.resolvePaths(doc, options, notes);
    changed ||= paths;

    const extracted = this.extractSecrets(doc, notes);
    changed ||= extracted.length > 0;

    const buildMode = Object.values(doc.services ?? {}).some((s) => s.build)
      ? BuildMode.COMPOSE
      : BuildMode.NONE;

    if (changed && /^\s*#/m.test(text)) {
      notes.push(
        'The file had to be rewritten, so its comments were not kept.',
      );
    }

    return {
      compose: changed ? this.dump(doc) : text,
      extracted,
      notes,
      buildMode,
    };
  }

  /**
   * Variables the file reads from its environment, with whether a default
   * covers them. Used to block a deployment that would start with an empty
   * password rather than fail (I6).
   */
  referencedVariables(text: string): { key: string; hasDefault: boolean }[] {
    const found = new Map<string, boolean>();

    for (const match of text.matchAll(COMPOSE_VARIABLE)) {
      const key = match[1] ?? match[3];
      if (!key) continue; // the $$ escape
      const operator = match[2];
      const hasDefault = operator !== undefined && !operator.includes('?');
      found.set(key, (found.get(key) ?? true) && hasDefault);
    }

    return [...found].map(([key, hasDefault]) => ({ key, hasDefault }));
  }

  /**
   * The file as deployed: identifying labels added to every service, so the
   * stack is recognised as managed and its status mapped to the application.
   * `text` has already been interpolated.
   */
  render(
    text: string,
    input: ComposeRenderInput,
    options: { inClone?: boolean } = {},
  ): string {
    const doc = this.parse(text);

    // Stored files were normalised, but the guard is repeated here: this is the
    // last point before the file reaches the host.
    this.resolvePaths(
      doc,
      { envFilePath: '.env', inClone: options.inClone },
      [],
    );

    for (const service of Object.values(doc.services ?? {})) {
      service.labels = {
        ...this.labelMap(service.labels),
        [HOMELAB_LABELS.app]: input.slug,
        [HOMELAB_LABELS.tier]: input.tier,
        [HOMELAB_LABELS.release]: input.releaseId,
      };
    }

    return this.dump(doc);
  }

  private parse(text: string): ComposeDoc {
    let doc: unknown;
    try {
      doc = yaml.load(text);
    } catch (error) {
      throw new BadRequestException(
        `The compose file is not valid YAML: ${
          error instanceof Error ? error.message : 'parse error'
        }`,
      );
    }

    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      throw new BadRequestException('The compose file is not a YAML mapping.');
    }

    const services = (doc as ComposeDoc).services;
    if (
      !services ||
      typeof services !== 'object' ||
      Object.keys(services).length === 0
    ) {
      throw new BadRequestException('The compose file declares no services.');
    }

    for (const [name, service] of Object.entries(services)) {
      if (typeof service !== 'object' || service === null) {
        throw new BadRequestException(`Service "${name}" is not a mapping.`);
      }
    }

    return doc as ComposeDoc;
  }

  private dump(doc: ComposeDoc): string {
    return yaml.dump(doc, { lineWidth: -1, noRefs: true });
  }

  // — paths —

  /** Returns whether anything was rewritten. */
  private resolvePaths(
    doc: ComposeDoc,
    options: { workingDir?: string; envFilePath: string; inClone?: boolean },
    notes: string[],
  ): boolean {
    let changed = false;
    let readByAgent = false;

    const fix = (value: string, where: string): string => {
      // Built from a variable (${APP_CONTEXT:-.}): compose resolves it at run
      // time from the env file, and only its value says what it points at.
      if (value.includes('${') && !value.startsWith('/')) {
        notes.push(
          `${where} "${value}" is built from a variable; give it an absolute ` +
            'path in Environment, or its default applies.',
        );
        return value;
      }
      if (!this.isRelativePath(value)) return value;

      if (options.inClone) {
        // Run from the clone: `.` and `./server` are the repository's code.
        // Data is another matter — a reclone deletes the directory.
        if (!where.includes('volume')) return value;
        throw new BadRequestException(
          `${where} uses the relative path "${value}", which would keep the ` +
            "application's data inside its git clone — deleted by a reclone. Use " +
            'an absolute path on the host, e.g. /mnt/VAULT/APPS/<app>/data.',
        );
      }

      if (!options.workingDir) {
        throw new BadRequestException(
          `${where} uses the relative path "${value}". The file is stored in the ` +
            'homelab repository, so a relative path would point inside it. Use ' +
            'an absolute path on the host, e.g. /mnt/VAULT/APPS/<app>/data.',
        );
      }

      const resolved = path.posix.join(options.workingDir, value);
      notes.push(`${where}: "${value}" → "${resolved}"`);
      readByAgent ||= !where.includes('volume');
      changed = true;
      return resolved;
    };

    for (const [name, service] of Object.entries(doc.services ?? {})) {
      if (Array.isArray(service.volumes)) {
        service.volumes = service.volumes.map((volume: unknown) =>
          this.fixVolume(volume, (v) => fix(v, `Service "${name}" volume`)),
        );
      }

      if (typeof service.build === 'string') {
        service.build = this.fixContext(service.build, (v) =>
          fix(v, `Service "${name}" build context`),
        );
      } else if (service.build && typeof service.build === 'object') {
        const build = service.build as Record<string, unknown>;
        if (typeof build.context === 'string') {
          build.context = this.fixContext(build.context, (v) =>
            fix(v, `Service "${name}" build context`),
          );
        }
      }

      if (service.env_file !== undefined) {
        service.env_file = this.fixEnvFiles(service.env_file, options, (v) =>
          fix(v, `Service "${name}" env_file`),
        );
      }
    }

    for (const section of ['configs', 'secrets']) {
      const entries = doc[section];
      if (!entries || typeof entries !== 'object') continue;

      for (const [name, entry] of Object.entries(
        entries as Record<string, Record<string, unknown>>,
      )) {
        if (entry && typeof entry.file === 'string') {
          entry.file = fix(entry.file, `Top-level ${section} "${name}"`);
        }
      }
    }

    // Volumes are resolved by the daemon on the host; env files, build
    // contexts and file-based configs are read by compose itself, inside the
    // agent's container — which therefore has to see the old directory.
    if (readByAgent) {
      notes.push(
        `Files under ${options.workingDir} are still read at deploy time (env ` +
          'files, build contexts), so the agent must have that directory mounted ' +
          '— the bootstrap mounts the whole /mnt/VAULT/APPS.',
      );
    }

    return changed;
  }

  /** Compose treats a volume source as a path when it starts with . / or ~. */
  private isRelativePath(value: string): boolean {
    return value.startsWith('.') || value.startsWith('~');
  }

  private fixVolume(volume: unknown, fix: (v: string) => string): unknown {
    if (typeof volume === 'string') {
      const [source, ...rest] = volume.split(':');
      return rest.length ? [fix(source), ...rest].join(':') : volume;
    }

    if (volume && typeof volume === 'object') {
      const long = volume as Record<string, unknown>;
      if (typeof long.source === 'string' && long.type !== 'volume') {
        return { ...long, source: fix(long.source) };
      }
    }

    return volume;
  }

  /** A remote build context (git URL) is not a path. */
  private fixContext(context: string, fix: (v: string) => string): string {
    if (
      /^[a-z][a-z0-9+.-]*:\/\//i.test(context) ||
      context.startsWith('git@')
    ) {
      return context;
    }
    if (context.startsWith('/')) return context;
    const asIs = context.startsWith('.') || context.includes('${');
    return fix(asIs ? context : `./${context}`);
  }

  /**
   * The env file the agent writes is the one relative env_file allowed in a
   * pasted file. Taken over, every relative one is resolved against the old
   * directory — those files stay on the host and are still read.
   */
  private fixEnvFiles(
    value: unknown,
    options: { workingDir?: string; envFilePath: string; inClone?: boolean },
    fix: (v: string) => string,
  ): unknown {
    const one = (file: string) => {
      if (file.startsWith('/')) return file;
      const own = path.posix.normalize(file) === options.envFilePath;
      if (own && !options.workingDir) return file;
      return fix(file.startsWith('.') ? file : `./${file}`);
    };

    if (typeof value === 'string') return one(value);
    if (Array.isArray(value)) {
      return value.map((entry) => {
        if (typeof entry === 'string') return one(entry);
        if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.path === 'string'
        ) {
          return { ...entry, path: one(entry.path) };
        }
        return entry;
      });
    }
    return value;
  }

  // — secrets —

  private extractSecrets(doc: ComposeDoc, notes: string[]): ExtractedSecret[] {
    const found: { service: string; key: string; value: string }[] = [];

    for (const [name, service] of Object.entries(doc.services ?? {})) {
      for (const [key, value] of this.envEntries(service.environment)) {
        if (!SECRET_KEY_PATTERN.test(key) || !value) continue;
        // Already a reference: nothing inline to move.
        if (/\$\{?[A-Za-z_]/.test(value) && !value.includes('$$')) continue;
        found.push({ service: name, key, value });
      }
    }

    if (!found.length) return [];

    // One name per value: two services sharing a password share the entry;
    // the same name holding different values gets the service as a prefix.
    const byKey = new Map<string, Set<string>>();
    for (const f of found) {
      byKey.set(f.key, (byKey.get(f.key) ?? new Set()).add(f.value));
    }

    const extracted = new Map<string, string>();
    const nameFor = (f: { service: string; key: string }) =>
      (byKey.get(f.key)?.size ?? 0) > 1
        ? `${f.service.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_${f.key}`
        : f.key;

    for (const f of found) {
      const key = nameFor(f);
      if (!ENV_KEY.test(key)) {
        throw new BadRequestException(
          `Cannot move the secret "${f.key}" of service "${f.service}" out of the file.`,
        );
      }
      extracted.set(key, f.value);
      this.setEnv(doc.services![f.service], f.key, `\${${key}}`);
    }

    // The same value elsewhere — a healthcheck repeating the password — would
    // otherwise stay in the file in plain text.
    const replaceable = [...extracted]
      .filter(([, value]) => value.length >= MIN_REPLACEABLE_SECRET)
      .sort((a, b) => b[1].length - a[1].length);
    if (replaceable.length) this.replaceInStrings(doc, replaceable);

    notes.push(
      `Moved ${extracted.size} inline secret(s) out of the file into encrypted ` +
        `environment entries: ${[...extracted.keys()].join(', ')}. The file now ` +
        'reads them as ${KEY} from the .env written at deploy time.',
    );

    return [...extracted].map(([key, value]) => ({ key, value }));
  }

  private envEntries(environment: unknown): [string, string][] {
    if (Array.isArray(environment)) {
      return environment.map((entry) => {
        const [key, ...rest] = String(entry).split('=');
        return [key, rest.join('=')];
      });
    }
    if (environment && typeof environment === 'object') {
      return Object.entries(environment as Record<string, unknown>).map(
        ([key, value]) => [key, value === null ? '' : String(value)],
      );
    }
    return [];
  }

  private setEnv(
    service: Record<string, unknown>,
    key: string,
    value: string,
  ): void {
    if (Array.isArray(service.environment)) {
      service.environment = service.environment.map((entry: unknown) =>
        String(entry).split('=')[0] === key ? `${key}=${value}` : entry,
      );
    } else {
      (service.environment as Record<string, unknown>)[key] = value;
    }
  }

  private replaceInStrings(
    node: unknown,
    secrets: [string, string][],
  ): unknown {
    if (typeof node === 'string') {
      let result = node;
      for (const [key, value] of secrets) {
        if (result.includes(value))
          result = result.split(value).join(`\${${key}}`);
      }
      return result;
    }
    if (Array.isArray(node)) {
      node.forEach(
        (item, i) => (node[i] = this.replaceInStrings(item, secrets)),
      );
      return node;
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        record[key] = this.replaceInStrings(record[key], secrets);
      }
      return record;
    }
    return node;
  }

  private labelMap(labels: unknown): Record<string, string> {
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
