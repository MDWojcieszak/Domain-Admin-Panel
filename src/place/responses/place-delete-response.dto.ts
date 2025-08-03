import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class PlaceDeleteResponseDto {
  @IsBoolean()
  deleted: boolean;

  @IsString({
    description:
      "'place' if the place was deleted, 'membership' if just membership was removed",
  })
  type: 'place' | 'membership';
}
