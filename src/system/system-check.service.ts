import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

import { PrismaService } from '../prisma/prisma.service';
import {
  SubsystemCheckResponse,
  SystemStatusResponse,
} from './responses';

// amqplib ships no bundled types in this setup — loose require for the check.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqp = require('amqplib');

const PROBE_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

@Injectable()
export class SystemCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Runs every subsystem probe and aggregates an overall status. */
  async checkAll(): Promise<SystemStatusResponse> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkMail(),
      this.checkRabbitMq(),
    ]);

    const db = checks.find((c) => c.name === 'database');
    let status: 'ok' | 'degraded' | 'down' = 'ok';
    if (db?.status === 'down') {
      status = 'down'; // DB is critical
    } else if (checks.some((c) => c.status === 'down')) {
      status = 'degraded'; // a non-critical subsystem is failing
    }

    return { status, checkedAt: new Date().toISOString(), checks };
  }

  async checkDatabase(): Promise<SubsystemCheckResponse> {
    const t0 = Date.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, PROBE_TIMEOUT_MS, 'db');
      return done('database', 'up', t0, null);
    } catch (e) {
      return done('database', 'down', t0, (e as Error).message);
    }
  }

  async checkMail(): Promise<SubsystemCheckResponse> {
    const host = this.config.get<string>('MAIL_HOST');
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');
    const port = Number(this.config.get('MAIL_PORT')) || 587;
    if (!host || !user || !pass) {
      return {
        name: 'mail',
        status: 'unconfigured',
        latencyMs: null,
        detail: 'MAIL_HOST / MAIL_USER / MAIL_PASS not set',
      };
    }

    const t0 = Date.now();
    const transporter = createTransport({
      host,
      port,
      auth: { user, pass },
      connectionTimeout: PROBE_TIMEOUT_MS,
      greetingTimeout: PROBE_TIMEOUT_MS,
      socketTimeout: PROBE_TIMEOUT_MS,
    });
    try {
      await transporter.verify();
      return done('mail', 'up', t0, `${host}:${port}`);
    } catch (e) {
      return done('mail', 'down', t0, (e as Error).message);
    } finally {
      transporter.close();
    }
  }

  async checkRabbitMq(): Promise<SubsystemCheckResponse> {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      return {
        name: 'rabbitmq',
        status: 'unconfigured',
        latencyMs: null,
        detail: 'RABBITMQ_URL not set',
      };
    }

    const t0 = Date.now();
    let conn: { close: () => Promise<void> } | undefined;
    try {
      conn = await withTimeout(amqp.connect(url), PROBE_TIMEOUT_MS, 'rabbitmq');
      return done('rabbitmq', 'up', t0, null);
    } catch (e) {
      return done('rabbitmq', 'down', t0, (e as Error).message);
    } finally {
      if (conn) await conn.close().catch(() => undefined);
    }
  }
}

function done(
  name: string,
  status: 'up' | 'down',
  t0: number,
  detail: string | null,
): SubsystemCheckResponse {
  return { name, status, latencyMs: Date.now() - t0, detail };
}
