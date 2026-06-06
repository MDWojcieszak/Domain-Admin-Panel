import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { randomBytes } from 'crypto';

import { OcrLang, OcrOEM, OcrPSM } from './enums';
import { OcrResponseDto } from './responses';
import { OcrOptionsDto } from './dto';
import { classifyDocument } from './doc-classifier';
import {
  linesToPlainText,
  normalizeReceiptText,
  parseInvoice,
  parseReceipt,
} from './utils';
import { RapidOcrClient } from './ocr-rapid.client';
import { CleanerService } from './cleaner.service';
import { OcrStructuredResponseDto } from './responses/ocr-structured-response.dto';
import { ClassificationService } from '../classification/classification.service';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly rapid: RapidOcrClient,
    private readonly cleaner: CleanerService,
    private readonly classification: ClassificationService,
  ) {}

  private async recognizeBuffer(buffer: Buffer, opts: OcrOptionsDto = {}) {
    const rot = (opts.rotate ?? 0) as 0 | 90 | 180 | 270;
    const maxW = opts.maxWidth ?? 1800;
    const thrFlag = opts.threshold ?? false;

    let img = sharp(buffer, { failOnError: false });
    const m0 = await img.metadata().catch(() => ({}) as any);
    this.logger.debug(
      `OCR input: ${m0.format} ${m0.width}x${m0.height}, size≈${buffer.byteLength}B`,
    );

    if (rot) img = img.rotate(rot);

    const currentW = m0.width ?? 0;
    const upscaleTarget =
      currentW > 0
        ? Math.min(Math.max(Math.floor(currentW * 1.5), maxW), 2200)
        : maxW;

    if (currentW > 0 && currentW < upscaleTarget) {
      img = img.resize({ width: upscaleTarget });
    } else if (currentW > maxW) {
      img = img.resize({ width: maxW, withoutEnlargement: true });
    }

    img = img.grayscale().gamma(1.05).normalize();
    if (thrFlag) img = img.threshold(175);

    const png = await img.png({ compressionLevel: 9 }).toBuffer();
    const m1 = await sharp(png).metadata();
    this.logger.debug(`OCR preprocessed: png ${m1.width}x${m1.height}`);

    const { lines } = await this.rapid.recognizeBuffer(
      png,
      `ocr-${Date.now()}-${randomBytes(4).toString('hex')}.png`,
    );

    return lines;
  }

  async recognize(
    buffer: Buffer,
    opts: OcrOptionsDto = {},
  ): Promise<OcrResponseDto> {
    const t0 = Date.now();

    const lang = opts.lang ?? OcrLang.POLISH;
    const baseLang = lang === OcrLang.POLISH ? 'pol+eng' : `${lang}+eng`;
    const psmDefault = (opts.psm ?? OcrPSM.SINGLE_BLOCK) as OcrPSM;
    const oem = (opts.oem ?? OcrOEM.LSTM_ONLY) as OcrOEM;
    const lines = await this.recognizeBuffer(buffer, opts);

    const text = this.toPlainTextFromLines(lines as any);
    const text2 = linesToPlainText(lines as any);
    Logger.log(text);
    Logger.log(text2);
    const normalized = normalizeReceiptText(text || '');
    const cls = classifyDocument(normalized);

    let structured: any = { raw: normalized };
    if (cls.type === 'receipt') {
      structured = parseReceipt(normalized);
    } else if (cls.type === 'invoice') {
      structured = parseInvoice(normalized);
    }

    return {
      text: structured,
      durationMs: Date.now() - t0,
      used: {
        lang: baseLang,
        psm: psmDefault,
        oem,
        rotate: 0,
        width: 0,
        threshold: false,
      },
    };
  }

  async recognizeFile(file: Express.Multer.File, opts: OcrOptionsDto) {
    return this.recognize(file.buffer, opts);
  }

  async recognizeStructured(
    file: Express.Multer.File,
  ): Promise<OcrStructuredResponseDto> {
    const lines = await this.recognizeBuffer(file.buffer);

    const text = this.toPlainTextFromLines(lines as any);
    Logger.log(text);

    const structured = await this.cleaner.structureFromOcrText(text);
    const classified = await this.classification.classify(structured);
    return classified;
  }

  private toPlainTextFromLines(
    lines: { text: string; box: number[] }[][],
  ): string {
    return lines
      .map((row) =>
        row
          .sort((a, b) => a.box[0] - b.box[0])
          .map((t) => t.text.trim())
          .join(' '),
      )
      .join('\n')
      .trim();
  }
}
