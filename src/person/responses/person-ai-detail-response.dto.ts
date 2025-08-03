import { IsString, IsNested, IsEnum } from 'nestjs-swagger-dto';
import { AiContextDto } from '../../common/dto/ai-context.dto';
import { PersonRelation } from '@prisma/client';

export class PersonAiDetailResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  nickname?: string;

  @IsString({ optional: true })
  email?: string;

  @IsString({ optional: true })
  phone?: string;

  @IsString({ optional: true })
  notes?: string;

  @IsString({ optional: true })
  avatarUrl?: string;

  @IsEnum({ enum: { PersonRelation }, optional: true })
  relation?: string;

  @IsNested({ type: AiContextDto, optional: true })
  aiContext?: AiContextDto;
}
