import { PersonRelation } from '@prisma/client';
import { IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

export class PersonCreateDto {
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

  @IsDate({ format: 'date-time', optional: true })
  birthday?: Date;

  @IsString({ optional: true })
  avatarUrl?: string;

  @IsEnum({ enum: { PersonRelation }, optional: true })
  relation?: PersonRelation;

  @IsString({
    optional: true,
    description: 'Location ID to associate with this person',
  })
  locationId?: string;

  //TODO: enable when Social Media done
  //   @IsNested({ type: SocialMediaDto, isArray: true, optional: true })
  //   socialMedia?: SocialMediaDto[];
}
