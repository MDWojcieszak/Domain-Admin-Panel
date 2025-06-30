import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ImageDataDto, ImageDto, ImageSizeType } from './dto';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { ImageService } from './image.service';
import { Response } from 'express';
import { PaginationDto } from '../common/dto';
import { ImageDataResponseDto, ImageListResponseDto } from './responses';

@ApiTags('Image')
@Controller('image')
export class ImageController {
  constructor(private imageService: ImageService) {}

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
  @Roles('USER', 'MODERATOR', 'ADMIN', 'OWNER')
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
  @Roles('MODERATOR', 'ADMIN', 'OWNER')
  @Delete()
  @ApiOkResponse({ description: 'Delete image' })
  async delete(@Query() dto: ImageDto) {
    return this.imageService.delete(dto);
  }
}
