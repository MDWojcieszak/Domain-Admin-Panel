import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import {
  GenerateTokenResponseDto,
  SaveServiceTokenResponseDto,
  TokenListResponseDto,
  TokenMetadataResponseDto,
} from './responses';
import { GenerateTokenDto, SaveServiceTokenDto } from './dto';
import { TokenService } from './token.service';
import { PaginationDto } from '../common/dto';

@ApiTags('Token')
@ApiBearerAuth()
@Controller('token')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @RequirePermissions(PERMISSIONS.TOKEN_MANAGE)
  @Post('generate')
  @ApiOkResponse({
    description: 'Generate personal API token (INTERNAL or AI, write-once)',
    type: GenerateTokenResponseDto,
  })
  async generateToken(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: GenerateTokenDto,
  ): Promise<GenerateTokenResponseDto> {
    return await this.tokenService.generateExternalToken(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_MANAGE)
  @Post('save-service-token')
  @ApiOkResponse({
    description:
      'Save or update a service integration token (EXTERNAL, editable)',
    type: SaveServiceTokenResponseDto,
  })
  async saveServiceToken(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: SaveServiceTokenDto,
  ): Promise<SaveServiceTokenResponseDto> {
    return await this.tokenService.saveServiceToken(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_READ)
  @Get('list')
  @ApiOkResponse({
    description: 'List all tokens for current user (paginated)',
    type: TokenListResponseDto,
  })
  async listTokens(
    @GetCurrentUser('sub') userId: string,
    @Query() params: PaginationDto,
  ): Promise<TokenListResponseDto> {
    return this.tokenService.listUserTokens(userId, params);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_READ)
  @Get(':id')
  @ApiOkResponse({
    description: 'Get token metadata (never reveals token value!)',
    type: TokenMetadataResponseDto,
  })
  async getTokenMetadata(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<TokenMetadataResponseDto> {
    return this.tokenService.getTokenMetadata(userId, id);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_MANAGE)
  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete/revoke token',
    type: TokenMetadataResponseDto,
  })
  async deleteToken(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<TokenMetadataResponseDto> {
    return this.tokenService.deleteToken(userId, id);
  }
}
