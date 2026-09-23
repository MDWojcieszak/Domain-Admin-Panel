import { LogRedactionService, REDACTED } from './log-redaction.service';

describe('LogRedactionService', () => {
  let service: LogRedactionService;

  beforeEach(() => {
    service = new LogRedactionService();
  });

  it('replaces a registered secret anywhere in the line', () => {
    service.register('p1', ['hunter2']);

    expect(
      service.redact('p1', 'DATABASE_URL=postgres://u:hunter2@db/app'),
    ).toBe(`DATABASE_URL=postgres://u:${REDACTED}@db/app`);
  });

  it('replaces every occurrence, not just the first', () => {
    service.register('p1', ['s3cret']);

    expect(service.redact('p1', 's3cret and again s3cret')).toBe(
      `${REDACTED} and again ${REDACTED}`,
    );
  });

  it('leaves lines without secrets untouched', () => {
    service.register('p1', ['hunter2']);

    expect(service.redact('p1', 'Step 3/12 : COPY . .')).toBe(
      'Step 3/12 : COPY . .',
    );
  });

  // A secret that contains another must be replaced first; otherwise the
  // shorter one turns part of it into *** and the longer match never happens.
  it('replaces the longest secret first when one contains another', () => {
    service.register('p1', ['pass', 'password123']);

    expect(service.redact('p1', 'using password123 now')).toBe(
      `using ${REDACTED} now`,
    );
  });

  // A two-character "secret" appears inside timestamps and paths; redacting it
  // would shred the log while protecting nothing worth the name.
  it('does not redact values shorter than the minimum length', () => {
    service.register('p1', ['ab']);

    expect(service.redact('p1', 'Step 3/12 : ab')).toBe('Step 3/12 : ab');
  });

  it('still redacts the usable secrets when one is too short', () => {
    service.register('p1', ['ab', 'hunter2']);

    expect(service.redact('p1', 'ab hunter2')).toBe(`ab ${REDACTED}`);
  });

  it('keeps secrets separate per process', () => {
    service.register('p1', ['alpha-secret']);
    service.register('p2', ['beta-secret']);

    expect(service.redact('p1', 'beta-secret')).toBe('beta-secret');
    expect(service.redact('p2', 'beta-secret')).toBe(REDACTED);
  });

  it('passes lines through for an unknown or missing process', () => {
    expect(service.redact('nope', 'hunter2')).toBe('hunter2');
    expect(service.redact(undefined, 'hunter2')).toBe('hunter2');
  });

  it('stops redacting once the process is forgotten', () => {
    service.register('p1', ['hunter2']);
    service.forget('p1');

    expect(service.redact('p1', 'hunter2')).toBe('hunter2');
  });

  it('deduplicates repeated values', () => {
    service.register('p1', ['hunter2', 'hunter2']);

    expect(service.redact('p1', 'hunter2')).toBe(REDACTED);
  });

  it('drops expired entries on sweep', () => {
    jest.useFakeTimers();
    service.register('p1', ['hunter2']);

    jest.advanceTimersByTime(16 * 60 * 1000);
    service.sweep();

    expect(service.redact('p1', 'hunter2')).toBe('hunter2');
    jest.useRealTimers();
  });
});
