import { BadRequestException } from '@nestjs/common';

import {
  InterpolationScope,
  InterpolationValue,
  InterpolatorService,
} from './interpolator.service';

const scope = (
  entries: Record<string, string | InterpolationValue>,
): InterpolationScope =>
  new Map(
    Object.entries(entries).map(([key, entry]) => [
      key,
      typeof entry === 'string' ? { value: entry, isSecret: false } : entry,
    ]),
  );

const secret = (value: string): InterpolationValue => ({
  value,
  isSecret: true,
});

describe('InterpolatorService', () => {
  let service: InterpolatorService;

  beforeEach(() => {
    service = new InterpolatorService();
  });

  describe('interpolate', () => {
    it('replaces a placeholder with its value', () => {
      const result = service.interpolate(
        'host=[[DB_HOST]]',
        scope({ DB_HOST: 'localhost' }),
      );

      expect(result.value).toBe('host=localhost');
      expect(result.usedKeys).toEqual(['DB_HOST']);
    });

    it('leaves text without placeholders untouched', () => {
      const result = service.interpolate('plain value', scope({}));

      expect(result.value).toBe('plain value');
      expect(result.usedKeys).toEqual([]);
    });

    it('replaces every occurrence in a single string', () => {
      const result = service.interpolate(
        'postgresql://[[USER]]:[[PASS]]@[[HOST]]:5432/[[DB]]',
        scope({ USER: 'admin', PASS: 'hunter2', HOST: 'localhost', DB: 'app' }),
      );

      expect(result.value).toBe(
        'postgresql://admin:hunter2@localhost:5432/app',
      );
      expect(result.usedKeys).toEqual(['USER', 'PASS', 'HOST', 'DB']);
    });

    it('resolves references nested inside resolved values', () => {
      const result = service.interpolate(
        'url=[[DB_URL]]',
        scope({
          DB_URL: 'postgresql://[[DB_HOST]]:[[DB_PORT]]/app',
          DB_HOST: 'localhost',
          DB_PORT: '5432',
        }),
      );

      expect(result.value).toBe('url=postgresql://localhost:5432/app');
    });

    // Regression guard: the resolver recurses while a `replace` is in flight, so
    // a shared global regex would lose its place and drop later placeholders.
    it('keeps matching after a nested resolution', () => {
      const result = service.interpolate(
        '[[A]]-[[B]]-[[C]]',
        scope({ A: '[[INNER]]', B: 'b', C: 'c', INNER: 'a' }),
      );

      expect(result.value).toBe('a-b-c');
    });

    it('ignores malformed placeholders', () => {
      const result = service.interpolate(
        '[[ spaced ]] [[1NUMERIC]] [[]] [single]',
        scope({}),
      );

      expect(result.value).toBe('[[ spaced ]] [[1NUMERIC]] [[]] [single]');
    });

    // I6 — an undefined key must block the deploy, never resolve to "".
    it('throws on an undefined key', () => {
      expect(() => service.interpolate('pass=[[MISSING]]', scope({}))).toThrow(
        BadRequestException,
      );

      expect(() => service.interpolate('pass=[[MISSING]]', scope({}))).toThrow(
        /Undefined variable \[\[MISSING\]\]/,
      );
    });

    it('throws on a direct circular reference', () => {
      expect(() => service.interpolate('[[A]]', scope({ A: '[[A]]' }))).toThrow(
        /Circular variable reference: A -> A/,
      );
    });

    it('throws on an indirect circular reference', () => {
      expect(() =>
        service.interpolate(
          '[[A]]',
          scope({ A: '[[B]]', B: '[[C]]', C: '[[A]]' }),
        ),
      ).toThrow(/Circular variable reference: A -> B -> C -> A/);
    });

    it('throws when the reference chain is deeper than the limit', () => {
      const deep: Record<string, string> = {};
      for (let i = 0; i < 15; i++) deep[`K${i}`] = `[[K${i + 1}]]`;
      deep.K15 = 'end';

      expect(() => service.interpolate('[[K0]]', scope(deep))).toThrow(
        /exceeded 10 levels/,
      );
    });

    it('collects resolved secret values for log redaction', () => {
      const result = service.interpolate(
        'url=postgresql://[[USER]]:[[PASS]]@db/app',
        scope({ USER: 'admin', PASS: secret('hunter2') }),
      );

      expect(result.secretValues).toEqual(['hunter2']);
    });

    it('collects the resolved form of a secret built from other variables', () => {
      const result = service.interpolate(
        '[[DSN]]',
        scope({
          DSN: secret('postgresql://[[HOST]]/app'),
          HOST: 'localhost',
        }),
      );

      expect(result.value).toBe('postgresql://localhost/app');
      expect(result.secretValues).toEqual(['postgresql://localhost/app']);
    });

    it('reports each used key once, in first-seen order', () => {
      const result = service.interpolate(
        '[[B]] [[A]] [[B]]',
        scope({ A: 'a', B: 'b' }),
      );

      expect(result.usedKeys).toEqual(['B', 'A']);
    });
  });

  describe('interpolateRecord', () => {
    it('resolves every entry and aggregates the metadata', () => {
      const result = service.interpolateRecord(
        {
          DATABASE_URL: 'postgresql://[[USER]]:[[PASS]]@[[HOST]]/app',
          REDIS_URL: 'redis://[[HOST]]:6379',
          LOG_LEVEL: 'info',
        },
        scope({ USER: 'admin', PASS: secret('hunter2'), HOST: 'localhost' }),
      );

      expect(result.values).toEqual({
        DATABASE_URL: 'postgresql://admin:hunter2@localhost/app',
        REDIS_URL: 'redis://localhost:6379',
        LOG_LEVEL: 'info',
      });
      expect(result.usedKeys).toEqual(['USER', 'PASS', 'HOST']);
      expect(result.secretValues).toEqual(['hunter2']);
    });

    it('fails the whole record when one entry references an undefined key', () => {
      expect(() =>
        service.interpolateRecord(
          { OK: 'fine', BROKEN: '[[NOPE]]' },
          scope({}),
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('findMissingKeys', () => {
    it('lists undefined keys without throwing', () => {
      const missing = service.findMissingKeys(
        ['[[KNOWN]] [[MISSING_A]]', '[[MISSING_B]]'],
        scope({ KNOWN: 'value' }),
      );

      expect(missing).toEqual(['MISSING_A', 'MISSING_B']);
    });

    it('finds keys missing from a nested reference', () => {
      const missing = service.findMissingKeys(
        ['[[OUTER]]'],
        scope({ OUTER: 'prefix-[[INNER]]' }),
      );

      expect(missing).toEqual(['INNER']);
    });

    it('returns an empty list when everything resolves', () => {
      expect(
        service.findMissingKeys(['[[A]]'], scope({ A: '[[B]]', B: 'value' })),
      ).toEqual([]);
    });

    it('terminates on a circular reference instead of hanging', () => {
      expect(
        service.findMissingKeys(['[[A]]'], scope({ A: '[[B]]', B: '[[A]]' })),
      ).toEqual([]);
    });

    it('reports each missing key once', () => {
      const missing = service.findMissingKeys(
        ['[[GONE]] [[GONE]]', '[[GONE]]'],
        scope({}),
      );

      expect(missing).toEqual(['GONE']);
    });
  });
});
