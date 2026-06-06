import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  OllamaListModelsResponseDto,
  OllamaModelResponseDto,
  OllamaPullModelResponseDto,
} from '../responses';

export type OllamaGenerateOpts = {
  model?: string;
  format?: 'json' | null;
  options?: Record<string, any>;
};

export type OllamaTagsResponse = {
  models: OllamaModelResponseDto[];
};

@Injectable()
export class OllamaClient {
  private base = process.env.OLLAMA_URL || 'http://localhost:11434';

  async generate(prompt: string, opts: OllamaGenerateOpts = {}) {
    const {
      model = process.env.OLLAMA_MODEL || 'llama3.1:70b',
      format = null,
      options,
    } = opts;

    const { data } = await axios.post(
      `${this.base}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        format,
        options: { temperature: 0.2, num_ctx: 8192, ...options },
      },
      { timeout: 60_000 * 10 },
    );

    return String(data?.response ?? '');
  }

  async listModels(): Promise<OllamaListModelsResponseDto> {
    const { data } = await axios.get<OllamaTagsResponse>(
      `${this.base}/api/tags`,
      {
        timeout: 20_000,
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );

    const models = Array.isArray(data?.models) ? data.models : [];
    return {
      models,
      total: models.length,
    };
  }

  async pullModel(model: string): Promise<OllamaPullModelResponseDto> {
    const { data } = await axios.post<OllamaPullModelResponseDto>(
      `${this.base}/api/pull`,
      {
        model,
        stream: false,
      },
      {
        timeout: 30 * 60_000,
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );
    return data;
  }
}
