// src/ocr/ocr-rapid.client.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

export type RapidOcrBox = {
  rec_txt: string;
  dt_boxes: number[][]; // [[x1,y1],[x2,y2],...], usually 4 points
  score?: number | string;
};
export type RapidOcrResp = Record<string, RapidOcrBox>;

type Word = {
  text: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number; // bounding box (min/max)
  midY: number;
  height: number;
  width: number;
};

@Injectable()
export class RapidOcrClient {
  private readonly baseUrl =
    process.env.RAPID_OCR_URL || 'http://rapidocr:9003';

  async recognizeBuffer(buf: Buffer, filename = 'image.png') {
    const form = new (FormData as any)();
    form.append('image_file', buf, { filename, contentType: 'image/png' });

    const { data } = await axios.post<RapidOcrResp>(
      `${this.baseUrl}/ocr`,
      form,
      {
        headers: (form as any).getHeaders(),
        timeout: 30_000,
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );

    type Word = {
      text: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      h: number;
    };
    const words: Word[] = Object.values(data)
      .filter(
        (b) =>
          b?.rec_txt && Array.isArray(b.dt_boxes) && b.dt_boxes.length >= 4,
      )
      .map((b) => {
        const xs = b.dt_boxes.map((p) => p[0]);
        const ys = b.dt_boxes.map((p) => p[1]);
        const x1 = Math.min(...xs),
          x2 = Math.max(...xs);
        const y1 = Math.min(...ys),
          y2 = Math.max(...ys);
        return { text: b.rec_txt.trim(), x1, y1, x2, y2, h: y2 - y1 };
      })
      .filter((w) => w.text.length > 0);

    // nothing? return empty
    if (!words.length) return { text: '', lines: [] as any[] };

    // sort roughly top->bottom then left->right
    words.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

    // vertical overlap helper
    const vOverlap = (a: Word, b: Word) => {
      const top = Math.max(a.y1, b.y1);
      const bot = Math.min(a.y2, b.y2);
      const inter = Math.max(0, bot - top);
      const denom = Math.min(a.h, b.h) || 1;
      return inter / denom; // 0..1
    };

    // cluster rows
    const rows: Word[][] = [];
    const OVERLAP_THR = 0.35; // stricter row grouping

    for (const w of words) {
      const last = rows[rows.length - 1];
      if (!last) {
        rows.push([w]);
        continue;
      }
      // compare with row median box
      const ref = last[Math.floor(last.length / 2)];
      if (vOverlap(ref, w) >= OVERLAP_THR) last.push(w);
      else rows.push([w]);
    }

    // sort inside row & join with a SINGLE space (always)
    const linesOut: string[] = [];
    for (const row of rows) {
      row.sort((a, b) => a.x1 - b.x1);
      const line = row.map((t) => t.text).join(' ');
      linesOut.push(line.trim());
    }

    const text = linesOut.join('\n').trim();
    return {
      text,
      lines: rows.map((r) =>
        r.map((w) => ({ text: w.text, box: [w.x1, w.y1, w.x2, w.y2] })),
      ),
    };
  }
}
