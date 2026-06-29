import { IsString } from 'nestjs-swagger-dto';

export class CreateEmptyAlbumDto {
  @IsString({ minLength: 1, maxLength: 200, example: 'Komunia 2026' })
  albumName: string;
}
