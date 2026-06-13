import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class HomePinInputDto {
  @IsString()
  postId: string;

  @IsNumber({
    type: 'integer',
    min: 1,
    description: 'Slot position (1-based).',
  })
  position: number;
}

/** Replaces the full set of homepage pins (positions not listed become unpinned). */
export class SetHomePinsDto {
  @IsNested({ type: HomePinInputDto, isArray: true })
  pins: HomePinInputDto[];
}
