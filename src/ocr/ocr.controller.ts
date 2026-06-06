import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { OcrResponseDto } from './responses';
import { Public } from '../common/decorators';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrOptionsDto } from './dto';
import { OcrStructuredResponseDto } from './responses/ocr-structured-response.dto';

@ApiTags('OCR (dev)')
@ApiBearerAuth()
@Controller('dev/ocr')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post('recognize')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: OcrResponseDto })
  async recognize(
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
    @Body() body: OcrOptionsDto,
  ): Promise<OcrResponseDto> {
    return this.ocr.recognizeFile(file, body);
  }

  @Post('structured')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Recognize, clean, and structure OCR into items and totals',
  })
  @Public()
  @ApiConsumes('multipart/form-data')
  @HttpCode(200)
  @ApiOkResponse({ type: OcrStructuredResponseDto })
  async structured(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<OcrStructuredResponseDto> {
    return this.ocr.recognizeStructured(file);
  }
}
