import {
  Controller,
  Post,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { Express } from 'express';
import { FileDto } from './dto';
import { UploadResponseDto } from './responses';

@ApiTags('File')
@ApiBearerAuth()
@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

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
    @UploadedFile(new ImageValidationPipe())
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.fileService.uploadImage(file);
  }
}
