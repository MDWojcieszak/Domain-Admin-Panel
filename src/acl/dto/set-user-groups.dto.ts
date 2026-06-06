import { IsString } from 'nestjs-swagger-dto';

export class SetUserGroupsDto {
  @IsString({
    isArray: true,
    description:
      'Permission group IDs the user should belong to (replaces all)',
  })
  groupIds: string[];
}
