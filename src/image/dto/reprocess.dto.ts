import { IsEnum } from 'nestjs-swagger-dto';

export enum ReprocessTargetMode {
  missing = 'missing',
  all = 'all',
}

export class ReprocessDto {
  /**
   * `missing` (default) — images not cleanly processed (pending/failed).
   * `all` — re-save every image's derived data from its original.
   */
  @IsEnum({ enum: { ReprocessTargetMode }, optional: true })
  mode?: ReprocessTargetMode;
}
