import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

/**
 * Scrubs resolved secret values out of the agent's log stream before anything
 * is stored or broadcast (§10.4, invariants I3/I4).
 *
 * This is the last line of defence and it is needed: `docker compose` echoes
 * environment variables in several situations, and a leaked value would land in
 * `ProcessLog` **and** be pushed over the WebSocket to every panel in the
 * deployments room — persisted and distributed in one step.
 */

export const REDACTED = '***';

/**
 * Values shorter than this are not redacted.
 *
 * A two-character "secret" appears inside ordinary words, timestamps and paths;
 * redacting it would shred the log into noise while protecting nothing that
 * deserves the name. Such a value is reported instead, so it can be fixed.
 */
const MIN_REDACTABLE_LENGTH = 4;

/** Kept a little past the deployment, since logs can trail the final status. */
const RETENTION_MS = 15 * 60 * 1000;

interface Entry {
  values: string[];
  expiresAt: number;
}

@Injectable()
export class LogRedactionService {
  private readonly logger = new Logger(LogRedactionService.name);
  private readonly byProcess = new Map<string, Entry>();

  /**
   * Registers the secrets in play for one deployment. Called when a release is
   * created, before the agent can emit a single line.
   */
  register(processId: string, secretValues: string[]): void {
    const usable = secretValues.filter(
      (value) => value.length >= MIN_REDACTABLE_LENGTH,
    );
    const tooShort = secretValues.length - usable.length;

    if (tooShort > 0) {
      this.logger.warn(
        `${tooShort} secret value(s) are shorter than ${MIN_REDACTABLE_LENGTH} characters ` +
          'and will NOT be redacted from deployment logs. Lengthen them.',
      );
    }

    // Longest first: a secret that contains another must be replaced before the
    // shorter one turns part of it into *** and breaks the longer match.
    const sorted = [...new Set(usable)].sort((a, b) => b.length - a.length);

    this.byProcess.set(processId, {
      values: sorted,
      expiresAt: Date.now() + RETENTION_MS,
    });
  }

  redact(processId: string | undefined, line: string): string {
    if (!processId) return line;

    const entry = this.byProcess.get(processId);
    if (!entry?.values.length) return line;

    let result = line;
    for (const value of entry.values) {
      if (result.includes(value)) result = result.split(value).join(REDACTED);
    }

    return result;
  }

  /** Called once a release settles; the values are no longer needed. */
  forget(processId: string): void {
    this.byProcess.delete(processId);
  }

  @Interval(RETENTION_MS)
  sweep(): void {
    const now = Date.now();

    for (const [processId, entry] of this.byProcess) {
      if (entry.expiresAt < now) this.byProcess.delete(processId);
    }
  }
}
