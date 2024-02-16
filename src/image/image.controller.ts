import { Body, Controller, Delete, Get, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ImageDataDto, ImageDto, ImageSizeType, PaginationDto } from './dto';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { ImageService } from './image.service';
import { Response } from 'express';

@ApiTags('Image')
@Controller('image')
export class ImageController {
  constructor(private imageService: ImageService) {}

  // @Public()
  // @Get()
  // get(@Body() dto: PaginationDto) {
  //   return this.imageService.get(dto);
  // }

  @ApiBearerAuth()
  @Post('create')
  async create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: ImageDataDto,
  ) {
    return this.imageService.createData(dto, userId);
  }

  @Public()
  @Get('cover')
  async getCoverImage(@Body() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(dto.id, ImageSizeType.COVER);
    file.pipe(res);
  }

  @Public()
  @Get('low-res')
  async getLowResImage(@Body() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.LOW_RES,
    );
    file.pipe(res);
  }

  @Roles('USER', 'MODERATOR', 'ADMIN', 'OWNER')
  @Get('original')
  async getOriginalImage(@Body() dto: ImageDto, @Res() res: Response) {
    const file = await this.imageService.readImage(
      dto.id,
      ImageSizeType.ORIGINAL,
    );
    file.pipe(res);
  }

  @Delete()
  delete(@Body() dto: ImageDto) {
    return this.imageService.delete(dto);
  }
}
