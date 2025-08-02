import { IsObject, IsString } from 'nestjs-swagger-dto';

export class AiLogFieldsDto {
  @IsString({ optional: true, description: 'Prompt from user to the AI' })
  userPrompt?: string;

  @IsString({ optional: true, description: 'AI-generated response' })
  aiResponse?: string;

  @IsObject({ optional: true, description: 'Meta/object for AI log details' })
  aiMeta?: any;
}
