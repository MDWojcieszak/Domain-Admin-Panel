import { IsString } from 'nestjs-swagger-dto';

export class RollbackDto {
  @IsString({ description: 'Id of the ARCHIVED version to roll back to.' })
  versionId: string;
}
