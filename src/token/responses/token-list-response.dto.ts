import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { TokenMetadataResponseDto } from './token-metadata-response.dto';

export class TokenListResponseDto {
  @IsNested({ type: TokenMetadataResponseDto, isArray: true })
  tokens: TokenMetadataResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}
