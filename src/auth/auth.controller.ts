import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import {
  RegisterDto,
  RequestResetPasswordDto,
  ResetPasswordDto,
  SignInDto,
} from './dto';
import { TokensDto } from './responses';
import {
  GetCurrentUser,
  Public,
  RequirePermissions,
} from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../user/events';
import { RptGuard, RtGuard, UrtGuard } from './guards';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('local/signin')
  @ApiOperation({ summary: 'Sign in using email and password' })
  @ApiOkResponse({ description: 'Successfully logged in', type: TokensDto })
  signIn(@Body() dto: SignInDto, @Req() req: Request): Promise<TokensDto> {
    return this.authService.signIn(dto, req);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Log out user and invalidate session' })
  @ApiOkResponse({ description: 'User successfully logged out' })
  logout(@GetCurrentUser('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password-request')
  @ApiOperation({ summary: 'Initiate password reset request' })
  @ApiOkResponse({ description: 'Reset password email sent (if user exists)' })
  async resetPasswordRequest(@Body() dto: RequestResetPasswordDto) {
    return this.authService.initiatePasswordReset(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post('admin/reset-password/:userId')
  @ApiOperation({
    summary: 'Owner/admin: send a password reset email to a specific user',
  })
  @ApiOkResponse({ description: 'Password reset email sent to the user' })
  adminResetPassword(@Param('userId') userId: string) {
    return this.authService.adminInitiatePasswordReset(userId);
  }

  @Public()
  @ApiBearerAuth('JWT-reset-password')
  @UseGuards(RptGuard)
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiOkResponse({ description: 'Password reset successful' })
  async resetPassword(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.authService.resetPassword(userId, dto);
    return { message: 'Password reset successful' };
  }

  @Public()
  @ApiBearerAuth('JWT-refresh')
  @UseGuards(RtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiOkResponse({ type: TokensDto })
  refreshToken(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('sessionId') sessionId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<TokensDto> {
    return this.authService.refteshTokens(userId, sessionId, refreshToken);
  }

  @Public()
  @ApiBearerAuth('JWT-register-user')
  @UseGuards(UrtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('register')
  @ApiOperation({ summary: 'Finish registration by setting password' })
  @ApiOkResponse({ description: 'User registered successfully' })
  register(@GetCurrentUser('sub') userId: string, @Body() dto: RegisterDto) {
    return this.authService.register(userId, dto);
  }

  @Public()
  @ApiBearerAuth('JWT-register-user')
  @UseGuards(UrtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('check-register')
  @ApiOperation({ summary: 'Check if registration token is valid' })
  @ApiOkResponse({
    description: 'Returns email and first name if valid token',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        firstName: { type: 'string' },
      },
    },
  })
  checkRegister(@GetCurrentUser('sub') userId: string) {
    return this.authService.checkRegisterToken(userId);
  }

  @OnEvent('user.created')
  handleUserCreatedEvent(payload: UserCreatedEvent) {
    this.authService.initiateRegister(payload);
  }
}
