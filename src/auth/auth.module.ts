import { Module } from '@nestjs/common';
import { AuthController } from './auth.controlles';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RptStrategy, RtStrategy, UrtStrategy } from './strategies';
import { SessionService } from '../session/session.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    RtStrategy,
    UrtStrategy,
    RptStrategy,
    SessionService,
  ],
})
export class AuthModule {}
