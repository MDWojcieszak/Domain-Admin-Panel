import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileService } from './file.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { Response } from 'express';
import { FileDto } from './dto';

@ApiTags('File')
@ApiBearerAuth()
@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile(new ImageValidationPipe())
    file: Express.Multer.File,
  ) {
    return this.fileService.uploadImage(file);
  }
}
