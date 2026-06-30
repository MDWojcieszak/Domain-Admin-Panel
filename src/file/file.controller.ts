import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileService } from './file.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { Express } from 'express';
import { ImageScope } from '@prisma/client';
import { FileDto } from './dto';
import { MultiUploadResponseDto, UploadResponseDto } from './responses';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';

@ApiTags('File')
@ApiBearerAuth()
@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

  /**
   * Uploads a personal-gallery image (scope GALLERY). Blog media is uploaded
   * via POST /blog/media/upload (scope BLOG); the two pools never mix.
   */
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileDto })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error converting or saving file' })
  uploadImage(
    @GetCurrentUser('sub') userId: string,
    @UploadedFile(new ImageValidationPipe())
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.fileService.uploadImage(file, ImageScope.GALLERY, userId);
  }

  /** Upload one or many gallery images at once (best-effort per file). */
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Post('upload/images')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded',
    type: MultiUploadResponseDto,
  })
  uploadImages(
    @GetCurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<MultiUploadResponseDto> {
    return this.fileService.uploadMany(files, ImageScope.GALLERY, userId);
  }
}
