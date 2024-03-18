import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import {
  AuthDto,
  RegisterDto,
  RequestResetPasswordDto,
  ResetPasswordDto,
} from './dto';
import { Tokens } from './types';
import { GetCurrentUser, Public } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../user/events';
import { RptGuard, RtGuard, UrtGuard } from '../common/guards';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('local/signin')
  signIn(@Body() dto: AuthDto): Promise<Tokens> {
    return this.authService.signIn(dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@GetCurrentUser('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password-request')
  async resetPasswordRequest(@Body() dto: RequestResetPasswordDto) {
    return this.authService.initiatePasswordReset(dto);
  }

  @Public()
  @ApiBearerAuth('JWT-reset-password')
  @UseGuards(RptGuard)
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
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
  refteshToken(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('sessionId') sessionId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<Tokens> {
    return this.authService.refteshTokens(userId, sessionId, refreshToken);
  }

  @OnEvent('user.created')
  handleUserCreatedEvent(payload: UserCreatedEvent) {
    this.authService.initiateRegister(payload);
  }

  @Public()
  @ApiBearerAuth('JWT-register-user')
  @UseGuards(UrtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@GetCurrentUser('sub') userId: string, @Body() dto: RegisterDto) {
    return this.authService.register(userId, dto);
  }

  @Public()
  @ApiBearerAuth('JWT-register-user')
  @UseGuards(UrtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('check-register')
  checkRegisterToken(@GetCurrentUser('sub') userId: string) {
    return this.authService.checkRegisterToken(userId);
  }
}
