import { IsString } from 'nestjs-swagger-dto';

export class SetHeroDto {
  /**
   * Ordered image ids to feature on the homepage hero (replaces the current
   * selection). Index becomes the display order.
   */
  @IsString({ isArray: true })
  imageIds: string[];
}
