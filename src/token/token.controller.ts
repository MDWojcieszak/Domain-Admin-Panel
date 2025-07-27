import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, Roles } from '../common/decorators';
import {
  GenerateTokenResponseDto,
  SaveServiceTokenResponseDto,
} from './responses';
import { GenerateTokenDto, SaveServiceTokenDto } from './dto';
import { TokenService } from './token.service';

@ApiTags('Token')
@ApiBearerAuth()
@Controller('token')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Roles('MODERATOR', 'ADMIN', 'OWNER')
  @Post('generate')
  @ApiOkResponse({
    description: 'Generate integration API token (EXTERNAL, write-once)',
    type: GenerateTokenResponseDto,
  })
  async generateToken(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: GenerateTokenDto,
  ): Promise<GenerateTokenResponseDto> {
    return await this.tokenService.generateExternalToken(userId, dto);
  }

  @Roles('MODERATOR', 'ADMIN', 'OWNER')
  @Post('save-service-token')
  @ApiOkResponse({
    description:
      'Save or update a service integration token (EXTERNAL, editable)',
    type: Object,
  })
  async saveServiceToken(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') userRole: string,
    @Body() dto: SaveServiceTokenDto,
  ): Promise<SaveServiceTokenResponseDto> {
    return await this.tokenService.saveServiceToken(userId, dto);
  }
}
