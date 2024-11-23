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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ImageDataDto, ImageDto, ImageSizeType } from './dto';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { ImageService } from './image.service';
import { Response } from 'express';
import { PaginationDto } from '../common/dto';

@ApiTags('Image')
@Controller('image')
export class ImageController {
  constructor(private imageService: ImageService) {}

  @Public()
  @Get('list')
  async getList(@Query() dto: PaginationDto) {
    return await this.imageService.getMultiple(dto);
  }

  @Public()
  @Get()
  async get(@Query() dto: ImageDto) {
    return await this.imageService.getSingle(dto);
  }

  @ApiBearerAuth()
  @Post('create')
  async create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: ImageDataDto,
  ) {
    return this.imageService.createData(dto, userId);
  }

  @ApiBearerAuth()
  @Put()
  async update(@Query() dto: ImageDto, @Body() data: Partial<ImageDataDto>) {
    return this.imageService.updateData(dto, data);
  }

  @Public()
  @Get('cover')
  async getCoverImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(dto.id, ImageSizeType.COVER);
    file.pipe(res);
  }

  @Public()
  @Get('low-res')
  async getLowResImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.LOW_RES,
    );
    file.pipe(res);
  }

  @Roles('USER', 'MODERATOR', 'ADMIN', 'OWNER')
  @Get('original')
  async getOriginalImage(@Query() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.ORIGINAL,
    );
    file.pipe(res);
  }

  @ApiBearerAuth()
  @Roles('MODERATOR', 'ADMIN', 'OWNER')
  @Delete('/')
  async delete(@Query() dto: ImageDto) {
    return this.imageService.delete(dto);
  }
}
