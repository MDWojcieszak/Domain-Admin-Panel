import { IsString } from 'nestjs-swagger-dto';

export class TaskCommentUpdateDto {
  @IsString()
  comment: string;
}
