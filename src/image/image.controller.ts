import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ImageDataDto,
  ImageDto,
  ImageSizeType,
  ReprocessDto,
  ReprocessTargetMode,
} from './dto';
import {
  GetCurrentUser,
  Public,
  RequirePermissions,
} from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { ImageService } from './image.service';
import { ImageProcessingService } from './image-processing.service';
import { FileService } from '../file/file.service';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { FileDto } from '../file/dto';
import { UploadResponseDto } from '../file/responses';
import { Response } from 'express';
import { PaginationDto } from '../common/dto';
import {
  ImageDataResponseDto,
  ImageListResponseDto,
  ImageProcessingSummaryResponse,
  ReprocessStartedResponse,
} from './responses';

@ApiTags('Image')
@Controller('image')
export class ImageController {
  constructor(
    private imageService: ImageService,
    private imageProcessing: ImageProcessingService,
    private fileService: FileService,
  ) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Get('processing/summary')
  @ApiOkResponse({
    description: 'Derived-data migration status across all images',
    type: ImageProcessingSummaryResponse,
  })
  async processingSummary(): Promise<ImageProcessingSummaryResponse> {
    return this.imageProcessing.getSummary();
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Post('reprocess')
  @ApiOkResponse({
    description: 'Start (re)processing outdated images from originals',
    type: ReprocessStartedResponse,
  })
  async reprocess(
    @Body() dto: ReprocessDto,
  ): Promise<ReprocessStartedResponse> {
    const mode = dto.mode ?? ReprocessTargetMode.missing;
    return this.imageProcessing.startBackfill(mode);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Post(':id/original')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileDto })
  @ApiOkResponse({
    description:
      'Replace the original (e.g. higher quality) and rebuild derived',
    type: UploadResponseDto,
  })
  async replaceOriginal(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.fileService.replaceOriginal(id, file);
  }

  @Public()
  @Get('list')
  @ApiOkResponse({
    description: 'List of image data with pagination',
    type: ImageListResponseDto,
  })
  async getList(@Query() dto: PaginationDto): Promise<ImageListResponseDto> {
    return await this.imageService.getMultiple(dto);
  }

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Get single image metadata',
    type: ImageDataResponseDto,
  })
  async get(@Query() dto: ImageDto): Promise<ImageDataResponseDto> {
    return await this.imageService.getSingle(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Post('create')
  @ApiOkResponse({
    description: 'Create image metadata',
    type: ImageDataResponseDto,
  })
  async create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: ImageDataDto,
  ): Promise<ImageDataResponseDto> {
    return this.imageService.createData(dto, userId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Put()
  @ApiOkResponse({
    description: 'Update image metadata',
    type: ImageDataResponseDto,
  })
  async update(
    @Query() dto: ImageDto,
    @Body() data: Partial<ImageDataDto>,
  ): Promise<ImageDataResponseDto> {
    return this.imageService.updateData(dto, data);
  }

  @Public()
  @Get('cover')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({
    description: 'Get image cover file stream',
    content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
  })
  async getCoverImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(dto.id, ImageSizeType.COVER);
    file.pipe(res);
  }

  @Public()
  @Get('low-res')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({
    description: 'Get low resolution image stream',
    content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
  })
  async getLowResImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.LOW_RES,
    );
    file.pipe(res);
  }

  @ApiBearerAuth()
  @Get('original')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({
    description: 'Get original image file stream',
    content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
  })
  async getOriginalImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.ORIGINAL,
    );
    file.pipe(res);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
  @Delete()
  @ApiOkResponse({ description: 'Delete image' })
  async delete(@Query() dto: ImageDto) {
    return this.imageService.delete(dto);
  }
}
