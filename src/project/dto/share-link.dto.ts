import { ShareLinkAccess } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class CreateShareLinkDto {
  /** Who the link is for: "Kasia — groceries". */
  @IsString({ optional: true, nullable: true, maxLength: 100 })
  label?: string | null;

  @IsEnum({ enum: { ShareLinkAccess } })
  access: ShareLinkAccess;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  expiresAt?: string | null;

  /** Asked for when the link is opened; stored only as a hash. */
  @IsString({ optional: true, nullable: true, minLength: 4, maxLength: 200 })
  password?: string | null;
}
