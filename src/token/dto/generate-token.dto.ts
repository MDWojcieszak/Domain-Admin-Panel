import { IsBoolean, IsDate, IsString } from 'nestjs-swagger-dto';

export class GenerateTokenDto {
  @IsString({ maxLength: 64, example: 'Integration with ...' })
  name: string;

  @IsBoolean({
    optional: true,
    example: true,
    description: 'Should the token expire?',
  })
  expires?: boolean = true;

  @IsDate({
    format: 'date-time',
    optional: true,
    example: new Date('2023-10-01T00:00:00Z'),
  })
  expiresAt?: Date;

  //   @IsEnum({ enum: {} })
  //   type: TokenType;
}
