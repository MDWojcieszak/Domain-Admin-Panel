import { IsString } from 'nestjs-swagger-dto';

export class PullModelDto {
  @IsString({
    description: 'Full name of model',
    example: 'llama3.1:8b-instruct',
    minLength: 2,
  })
  model: string;
}
