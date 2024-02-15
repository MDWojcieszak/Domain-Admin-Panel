import { Module } from '@nestjs/common';
import { AuthController } from './auth.controlles';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RtStrategy } from './strategies';
import { JwtModule } from '@nestjs/jwt';
import { SessionService } from '../session/session.service';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService, UserService, RtStrategy, SessionService],
})
export class AuthModule {}
