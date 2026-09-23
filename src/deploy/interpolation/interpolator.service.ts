import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * Resolves `[[KEY]]` placeholders in application environment values and in the
 * textual fields of an AppSpec, before anything is handed to the deploy agent.
 *
 * Interpolation happens exclusively on the backend: the agent has no database
 * access and must receive a fully resolved payload (see docs/deploy-design.md
 * §10 and invariant I7).
 */

/** A single value available for `[[KEY]]` substitution. */
export interface InterpolationValue {
  value: string;
  isSecret: boolean;
}

/**
 * Flattened view of everything a render pass may reference. Built by the caller
 * in resolution order: application env entries shadow global variables (§10.2).
 */
export type InterpolationScope = ReadonlyMap<string, InterpolationValue>;

export interface InterpolationResult {
  /** Text with every placeholder replaced. */
  value: string;
  /** Keys actually referenced, in first-seen order. */
  usedKeys: string[];
  /**
   * Resolved values of referenced secrets. These feed log redaction (§10.4) so
   * that a value echoed by `docker compose` never reaches ProcessLog.
   */
  secretValues: string[];
}

export interface InterpolatedRecord {
  values: Record<string, string>;
  usedKeys: string[];
  secretValues: string[];
}

const PLACEHOLDER_SOURCE = String.raw`\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]`;

/**
 * A fresh regex per scan: the resolver recurses while a `replace` is in flight,
 * and a shared global regex would have its `lastIndex` clobbered by the nested
 * pass.
 */
const placeholderMatcher = () => new RegExp(PLACEHOLDER_SOURCE, 'g');

/** Guards against a reference chain that is deep rather than strictly cyclic. */
const MAX_DEPTH = 10;

@Injectable()
export class InterpolatorService {
  /** Resolves every placeholder in `text`, recursively. */
  interpolate(text: string, scope: InterpolationScope): InterpolationResult {
    const usedKeys: string[] = [];
    const secretValues = new Set<string>();

    const value = this.resolve(text, scope, [], usedKeys, secretValues);

    return { value, usedKeys, secretValues: [...secretValues] };
  }

  /**
   * Resolves a whole set of environment entries, accumulating the used keys and
   * secret values across all of them.
   */
  interpolateRecord(
    entries: Record<string, string>,
    scope: InterpolationScope,
  ): InterpolatedRecord {
    const values: Record<string, string> = {};
    const usedKeys: string[] = [];
    const secretValues = new Set<string>();

    for (const [key, raw] of Object.entries(entries)) {
      const result = this.interpolate(raw, scope);

      values[key] = result.value;
      for (const used of result.usedKeys) {
        if (!usedKeys.includes(used)) usedKeys.push(used);
      }
      for (const secret of result.secretValues) secretValues.add(secret);
    }

    return { values, usedKeys, secretValues: [...secretValues] };
  }

  /**
   * Lists placeholders that `scope` cannot satisfy, without throwing. Used by
   * the panel to show what still has to be filled in before a deploy is even
   * attempted — notably after importing a HOST stack, where secret values are
   * deliberately left empty (§8.5).
   */
  findMissingKeys(texts: string[], scope: InterpolationScope): string[] {
    const missing: string[] = [];
    const seen = new Set<string>();

    const walk = (text: string, depth: number) => {
      if (depth > MAX_DEPTH) return;

      for (const match of text.matchAll(placeholderMatcher())) {
        const key = match[1];
        const entry = scope.get(key);

        if (!entry) {
          if (!missing.includes(key)) missing.push(key);
          continue;
        }
        // Follow the chain once per key; cycles cannot grow the result set.
        if (seen.has(key)) continue;
        seen.add(key);
        walk(entry.value, depth + 1);
      }
    };

    for (const text of texts) walk(text, 0);

    return missing;
  }

  private resolve(
    text: string,
    scope: InterpolationScope,
    stack: string[],
    usedKeys: string[],
    secretValues: Set<string>,
  ): string {
    if (stack.length > MAX_DEPTH) {
      throw new BadRequestException(
        `Variable interpolation exceeded ${MAX_DEPTH} levels (chain: ${stack.join(' -> ')}).`,
      );
    }

    return text.replace(placeholderMatcher(), (_match, key: string) => {
      if (stack.includes(key)) {
        throw new BadRequestException(
          `Circular variable reference: ${[...stack, key].join(' -> ')}.`,
        );
      }

      const entry = scope.get(key);
      if (!entry) {
        // I6: an undefined key blocks the deployment. Substituting an empty
        // string would silently start the app with, say, a blank password.
        throw new BadRequestException(
          `Undefined variable [[${key}]]. Define it as an application env entry ` +
            `or as a global variable before deploying.`,
        );
      }

      if (!usedKeys.includes(key)) usedKeys.push(key);

      const resolved = this.resolve(
        entry.value,
        scope,
        [...stack, key],
        usedKeys,
        secretValues,
      );

      if (entry.isSecret) secretValues.add(resolved);

      return resolved;
    });
  }
}
