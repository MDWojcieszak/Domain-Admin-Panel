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

    const allowedMimeTypes = ['image/jpeg', 'image/png'];

    if (!allowedMimeTypes.includes(image.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    if (image.size > 1024 * 1024 * 24) {
      throw new BadRequestException('File size too large');
    }

    return value;
  }
}
