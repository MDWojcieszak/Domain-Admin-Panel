import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ImageModule } from './image/image.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionModule } from './session/session.module';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { AutorizatonGuard } from './common/guards';
import { JwtModule } from '@nestjs/jwt';
import { FileModule } from './file/file.module';
import { ServerModule } from './server/server.module';
import { config } from './config/config';
import { MultiVerseModule } from './multi-verse/multi-verse.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CronJobsModule } from './cron-jobs/cron-jobs.module';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [config],
    }),
    AuthModule,
    UserModule,
    ImageModule,
    PrismaModule,
    SessionModule,
    FileModule,
    ServerModule,
    MultiVerseModule,
    CronJobsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AutorizatonGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
