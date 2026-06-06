import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ImageModule } from './image/image.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionModule } from './session/session.module';
import { APP_GUARD } from '@nestjs/core';
import {
  AutorizatonGuard,
  PermissionsGuard,
  TokenGuard,
} from './common/guards';
import { JwtModule } from '@nestjs/jwt';
import { FileModule } from './file/file.module';
import { ServerModule } from './server/server.module';
import { config } from './config/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CronJobsModule } from './cron-jobs/cron-jobs.module';
import { ServerCommandsModule } from './server-commands/server-commands.module';
import { ServerSettingsModule } from './server-settings/server-settings.module';
import { ServerProcessModule } from './server-process/server-process.module';
import { WebsocketModule } from './websocket/websocket.module';
import { GalleryModule } from './gallery/gallery.module';
import { TokenService } from './token/token.service';
import { TokenModule } from './token/token.module';
import { PersonModule } from './person/person.module';
import { PersonController } from './person/person.controller';
import { PlaceModule } from './place/place.module';
import { TagModule } from './tag/tag.module';
import { TaskCommentModule } from './task-comment/task-comment.module';
import { OcrModule } from './ocr/ocr.module';
import { AiModule } from './ai/ai.module';
import { ClassificationModule } from './classification/classification.module';
import { ServerTransferModule } from './server-transfer/server-transfer.module';
import { AstroObjectModule } from './astro-object/astro-object.module';
import { PhotoEntryModule } from './photo-entry/photo-entry.module';
import { PhotoStorageModule } from './photo-storage-service/photo-storage.module';
import { ImmichModule } from './immich/immich.module';
import { ApiDocsModule } from './api-docs/api-docs.module';
import { AclModule } from './acl/acl.module';
import { AclCoreModule } from './common/acl/acl-core.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [config],
    }),
    JwtModule.register({ global: true }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UserModule,
    ImageModule,
    PrismaModule,
    SessionModule,
    FileModule,
    ServerModule,
    CronJobsModule,
    ServerCommandsModule,
    ServerSettingsModule,
    ServerProcessModule,
    WebsocketModule,
    GalleryModule,
    TokenModule,
    PersonModule,
    PlaceModule,
    TagModule,
    TaskCommentModule,
    OcrModule,
    AiModule,
    ClassificationModule,
    ServerTransferModule,
    AstroObjectModule,
    PhotoEntryModule,
    ImmichModule,
    ApiDocsModule,
    AclModule,
    AclCoreModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AutorizatonGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TokenGuard,
    },
    TokenService,
    PhotoStorageModule,
  ],
  controllers: [PersonController],
})
export class AppModule {}
