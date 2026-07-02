import { IsString } from 'nestjs-swagger-dto';

/** Ordered ids (index becomes `order`). Used for both gear items and systems. */
export class ReorderGearDto {
  @IsString({ isArray: true })
  ids: string[];
}
