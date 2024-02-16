import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    const image = value;
    if (!image) {
      throw new BadRequestException('No file uploaded');
    }

    if (image.mimetype !== 'image/jpeg') {
      throw new BadRequestException('Only JPEG files are allowed');
    }

    if (image.size > 1024 * 1024 * 24) {
      throw new BadRequestException('File size too large');
    }

    return value;
  }
}
