import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { PaginationDto } from '../../common/dto';
import { ImageValidationPipe } from '../../common/pipes/image-validation.pipe';
import { FileDto } from '../../file/dto';
import { UploadResponseDto } from '../../file/responses';
import { MediaService } from './media.service';
import {
  CreateBlogAlbumDto,
  PatchBlogAlbumDto,
  SetBlogAlbumItemsDto,
} from './dto';
import {
  BlogMediaAlbumListResponse,
  BlogMediaAlbumResponse,
  BlogMediaImageResponse,
  BlogMediaListResponse,
} from './responses';

@ApiBearerAuth()
@ApiTags('Blog · Media')
@Controller('blog/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // --- library ---

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileDto })
  @ApiOkResponse({
    description: 'Uploaded a BLOG-scoped image',
    type: UploadResponseDto,
  })
  upload(
    @GetCurrentUser('sub') userId: string,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.mediaService.upload(file, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Get()
  @ApiOkResponse({
    description: 'Blog media library (paginated)',
    type: BlogMediaListResponse,
  })
  list(@Query() query: PaginationDto): Promise<BlogMediaListResponse> {
    return this.mediaService.list(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Get('images/:id')
  @ApiOkResponse({ type: BlogMediaImageResponse })
  getImage(@Param('id') id: string): Promise<BlogMediaImageResponse> {
    return this.mediaService.getOne(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Delete('images/:id')
  @ApiOkResponse({
    description: 'Deleted a blog image (409 if still in use)',
    type: UploadResponseDto,
  })
  deleteImage(@Param('id') id: string): Promise<{ id: string }> {
    return this.mediaService.remove(id);
  }

  // --- albums ---

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Post('albums')
  @ApiOkResponse({ type: BlogMediaAlbumResponse })
  createAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateBlogAlbumDto,
  ): Promise<BlogMediaAlbumResponse> {
    return this.mediaService.createAlbum(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Get('albums')
  @ApiOkResponse({ type: BlogMediaAlbumListResponse })
  listAlbums(
    @Query() query: PaginationDto,
  ): Promise<BlogMediaAlbumListResponse> {
    return this.mediaService.listAlbums(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Get('albums/:id')
  @ApiOkResponse({ type: BlogMediaAlbumResponse })
  getAlbum(@Param('id') id: string): Promise<BlogMediaAlbumResponse> {
    return this.mediaService.getAlbum(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Put('albums/:id/items')
  @ApiOkResponse({
    description: 'Replaced album items (BLOG-scoped images only)',
    type: BlogMediaAlbumResponse,
  })
  setAlbumItems(
    @Param('id') id: string,
    @Body() dto: SetBlogAlbumItemsDto,
  ): Promise<BlogMediaAlbumResponse> {
    return this.mediaService.setItems(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Patch('albums/:id')
  @ApiOkResponse({ type: BlogMediaAlbumResponse })
  patchAlbum(
    @Param('id') id: string,
    @Body() dto: PatchBlogAlbumDto,
  ): Promise<BlogMediaAlbumResponse> {
    return this.mediaService.patchAlbum(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_MEDIA_MANAGE)
  @Delete('albums/:id')
  @ApiOkResponse({ type: UploadResponseDto })
  deleteAlbum(@Param('id') id: string): Promise<{ id: string }> {
    return this.mediaService.deleteAlbum(id);
  }
}
