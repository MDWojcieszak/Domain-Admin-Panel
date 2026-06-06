import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { GenerateTokenDto, SaveServiceTokenDto } from './dto';
import { ApiKeyType, ConnectedServiceType } from '@prisma/client';
import { PaginationDto } from '../common/dto';
import { ConfigService } from '@nestjs/config';

const algorithm = 'aes-256-gcm';
const ivLength = 12;

type EncryptedTokenPayload = {
  cipher: string;
  iv: string;
  tag: string;
};

@Injectable()
export class TokenService {
  private readonly key: Buffer;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.key = Buffer.from(
      this.config.get<string>('EXTERNAL_TOKEN_KEY')!,
      'hex',
    );
  }

  async getTokenMetadata(userId: string, id: string) {
    const token = await this.prisma.apiKey.findFirst({
      where: { id, userId },
      select: {
        id: true,
        service: true,
        name: true,
        type: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        meta: true,
      },
    });

    if (!token) throw new NotFoundException('Token not found');

    return token;
  }

  async listUserTokens(userId: string, params: PaginationDto) {
    const [tokens, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          service: true,
          name: true,
          type: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          meta: true,
        },
      }),
      this.prisma.apiKey.count({ where: { userId } }),
    ]);

    return { tokens, total, params };
  }

  async deleteToken(userId: string, id: string) {
    const token = await this.prisma.apiKey.findFirst({
      where: { id, userId },
      select: {
        id: true,
        service: true,
        name: true,
        type: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        meta: true,
      },
    });

    if (!token) {
      throw new NotFoundException('Token not found or already deleted');
    }

    await this.prisma.apiKey.delete({ where: { id } });

    return token;
  }

  async generateExternalToken(userId: string, dto: GenerateTokenDto) {
    if (dto.type === ApiKeyType.EXTERNAL) {
      throw new BadRequestException(
        'Only INTERNAL or AI token types are allowed for this endpoint',
      );
    }

    const rawToken = randomBytes(32).toString('hex');
    const hash = await argon2.hash(rawToken);

    let expiresAt: Date | undefined;
    if (dto.expires === false) {
      expiresAt = undefined;
    } else if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
    } else {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expiresAt = d;
    }

    await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        value: hash,
        service: ConnectedServiceType.OTHER,
        type: dto.type,
        expiresAt,
      },
    });

    return { token: rawToken, expiresAt };
  }

  async saveServiceToken(userId: string, dto: SaveServiceTokenDto) {
    const { cipher, iv, tag } = this.encrypt(dto.value);
    const encryptedValue = JSON.stringify({ cipher, iv, tag });

    const token = await this.prisma.apiKey.upsert({
      where: {
        userId_service_type: {
          userId,
          service: dto.service,
          type: ApiKeyType.EXTERNAL,
        },
      },
      update: {
        name: dto.name,
        value: encryptedValue,
        meta: { service: dto.service },
      },
      create: {
        userId,
        service: dto.service,
        name: dto.name,
        value: encryptedValue,
        type: ApiKeyType.EXTERNAL,
        meta: { service: dto.service },
      },
    });

    return {
      id: token.id,
      service: token.service,
      name: token.name,
      type: token.type,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      meta: token.meta,
    };
  }

  async getToken(
    userId: string,
    service: ConnectedServiceType,
    type: ApiKeyType = ApiKeyType.EXTERNAL,
  ) {
    const token = await this.prisma.apiKey.findUnique({
      where: {
        userId_service_type: {
          userId,
          service,
          type,
        },
      },
      select: {
        id: true,
        name: true,
        value: true,
        service: true,
        type: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        meta: true,
      },
    });

    if (!token) {
      throw new NotFoundException(
        `Token for service ${service} and type ${type} not found`,
      );
    }

    if (type === ApiKeyType.EXTERNAL) {
      const encrypted = this.parseEncryptedToken(token.value);
      const value = this.decrypt(encrypted);

      return {
        ...token,
        value,
      };
    }

    return token;
  }

  private parseEncryptedToken(value: string): EncryptedTokenPayload {
    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException(
        'Stored token has invalid encrypted format',
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('cipher' in parsed) ||
      !('iv' in parsed) ||
      !('tag' in parsed)
    ) {
      throw new BadRequestException('Stored token payload is incomplete');
    }

    const encrypted = parsed as EncryptedTokenPayload;

    if (!encrypted.cipher || !encrypted.iv || !encrypted.tag) {
      throw new BadRequestException('Stored token payload is invalid');
    }

    return encrypted;
  }

  private encrypt(text: string): { cipher: string; iv: string; tag: string } {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      cipher: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  private decrypt(encrypted: EncryptedTokenPayload): string {
    const decipher = createDecipheriv(
      algorithm,
      this.key,
      Buffer.from(encrypted.iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));

    let decrypted = decipher.update(encrypted.cipher, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
