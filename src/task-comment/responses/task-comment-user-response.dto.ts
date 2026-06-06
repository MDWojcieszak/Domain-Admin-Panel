import { IsString } from 'nestjs-swagger-dto';

export class TaskCommentUserResponseDto {
  @IsString()
  id: string;

  @IsString({ isEmail: true })
  email: string;

  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;
}
