import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { ReleaseService } from './release.service';

/**
 * Closes out releases that never reported a result (§6.4).
 *
 * Without this a lost report leaves the application permanently blocked: the
 * partial unique index that enforces "one deployment at a time" (I13) counts an
 * in-flight release, so a stuck one would refuse every future deployment.
 */
@Injectable()
export class ReleaseSweeperService {
  private readonly logger = new Logger(ReleaseSweeperService.name);

  constructor(private readonly releases: ReleaseService) {}

  @Interval(60_000)
  async sweep(): Promise<void> {
    try {
      await this.releases.sweepStale();
    } catch (error) {
      this.logger.error(
        'Release sweep failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
