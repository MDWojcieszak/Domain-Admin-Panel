import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

import { getRegisteredOutboundMessages } from '../common/decorators';

// @nestjs/microservices metadata keys (kept as literals to avoid deep imports).
const PATTERN_METADATA = 'microservices:pattern';
const PATTERN_HANDLER_METADATA = 'microservices:handler_type';
// PatternHandler enum: MESSAGE = 1, EVENT = 2.
const HANDLER_TYPE_EVENT = 2;

const IGNORED_PARAM_TYPES = new Set([
  'Object',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Function',
  'RmqContext',
  'NatsContext',
  'KafkaContext',
  'MqttContext',
  'RedisContext',
  'TcpContext',
]);

type InboundMessage = {
  channel: string;
  interaction: 'message' | 'event';
  payloadType?: Function;
};

export type MessagingDocsInfo = {
  title: string;
  version: string;
  description: string;
};

/**
 * Generates an AsyncAPI 2.6 contract for the RabbitMQ messaging between the
 * backend and remote servers. Fully independent of the REST/OpenAPI document:
 * - inbound (Server → Backend) is discovered from @MessagePattern/@EventPattern,
 * - outbound (Backend → Server) comes from the @OutboundMessage decorator
 *   registry on the event classes,
 * - payload schemas are produced directly from the DTO/event classes via the
 *   swagger SchemaObjectFactory (no full OpenAPI document is built).
 */
@Injectable()
export class MessagingDocsService {
  private readonly logger = new Logger(MessagingDocsService.name);
  private readonly schemaFactory = new SchemaObjectFactory(
    new ModelPropertiesAccessor(),
    new SwaggerTypesMapper(),
  );

  constructor(private readonly discovery: DiscoveryService) {}

  generate(info: MessagingDocsInfo): void {
    try {
      const inbound = this.discoverInbound();
      const outbound = getRegisteredOutboundMessages();

      const payloadClasses = this.uniqueClasses([
        ...inbound
          .map((message) => message.payloadType)
          .filter((type): type is Function => Boolean(type)),
        ...outbound.map((entry) => entry.payload),
      ]);

      const schemas = this.buildSchemas(payloadClasses);
      const document = this.buildAsyncApi(inbound, outbound, schemas, info);

      writeFileSync(
        join(process.cwd(), 'src', 'api', 'asyncapi.yaml'),
        yaml.dump(document, { noRefs: true }),
        'utf8',
      );

      this.logger.log(
        `Generated AsyncAPI messaging contract (${inbound.length} inbound + ${outbound.length} outbound channels) at src/api/asyncapi.yaml`,
      );
    } catch (error) {
      this.logger.error('Failed to generate AsyncAPI messaging contract', error);
    }
  }

  private discoverInbound(): InboundMessage[] {
    const controllers = this.discovery.getControllers();
    const byChannel = new Map<string, InboundMessage>();

    for (const wrapper of controllers) {
      const metatype = wrapper.metatype as
        | (Function & { prototype: object })
        | null;
      if (!metatype || !metatype.prototype) continue;

      const prototype = metatype.prototype;

      for (const key of Object.getOwnPropertyNames(prototype)) {
        if (key === 'constructor') continue;

        let handler: unknown;
        try {
          handler = (prototype as Record<string, unknown>)[key];
        } catch {
          continue;
        }
        if (typeof handler !== 'function') continue;

        const patterns = Reflect.getMetadata(PATTERN_METADATA, handler);
        if (!patterns) continue;

        const handlerType = Reflect.getMetadata(
          PATTERN_HANDLER_METADATA,
          handler,
        );
        const interaction =
          handlerType === HANDLER_TYPE_EVENT ? 'event' : 'message';

        const paramTypes: unknown[] =
          Reflect.getMetadata('design:paramtypes', prototype, key) || [];
        const payloadType = this.pickPayloadType(paramTypes);

        const patternList = Array.isArray(patterns) ? patterns : [patterns];
        for (const pattern of patternList) {
          const channel = this.patternToChannel(pattern);
          if (!channel || byChannel.has(channel)) continue;
          byChannel.set(channel, { channel, interaction, payloadType });
        }
      }
    }

    return Array.from(byChannel.values()).sort((a, b) =>
      a.channel.localeCompare(b.channel),
    );
  }

  private pickPayloadType(paramTypes: unknown[]): Function | undefined {
    for (const type of paramTypes) {
      if (typeof type === 'function' && !IGNORED_PARAM_TYPES.has(type.name)) {
        return type;
      }
    }
    return undefined;
  }

  private patternToChannel(pattern: unknown): string | null {
    if (typeof pattern === 'string') return pattern;
    if (pattern == null) return null;
    return JSON.stringify(pattern);
  }

  private uniqueClasses(classes: Function[]): Function[] {
    return Array.from(new Set(classes));
  }

  private buildSchemas(classes: Function[]): Record<string, unknown> {
    const schemas: Record<string, unknown> = {};

    for (const cls of classes) {
      try {
        this.schemaFactory.exploreModelSchema(cls, schemas as never);
      } catch (error) {
        this.logger.warn(
          `Failed to build schema for ${cls?.name ?? 'unknown'}: ${
            (error as Error).message
          }`,
        );
      }
    }

    return schemas;
  }

  private buildAsyncApi(
    inbound: InboundMessage[],
    outbound: ReturnType<typeof getRegisteredOutboundMessages>,
    schemas: Record<string, unknown>,
    info: MessagingDocsInfo,
  ) {
    const channels: Record<string, unknown> = {};
    const messages: Record<string, unknown> = {};

    for (const message of inbound) {
      const messageName = message.payloadType
        ? message.payloadType.name
        : `${this.sanitize(message.channel)}Message`;

      messages[messageName] = this.buildMessage(
        messageName,
        message.payloadType?.name,
        schemas,
      );

      channels[message.channel] = {
        description: 'Direction: Server → Backend',
        publish: {
          operationId: `recv_${this.sanitize(message.channel)}`,
          'x-direction': 'server->backend',
          'x-interaction': message.interaction,
          message: { $ref: `#/components/messages/${messageName}` },
        },
      };
    }

    for (const entry of outbound) {
      const messageName = entry.payload.name;

      messages[messageName] = this.buildMessage(messageName, messageName, schemas);

      const channel: Record<string, unknown> = {
        description: `Direction: Backend → Server.${
          entry.meta.summary ? ` ${entry.meta.summary}` : ''
        }`,
        subscribe: {
          operationId: `send_${this.sanitize(entry.meta.pattern)}`,
          'x-direction': 'backend->server',
          'x-interaction': entry.meta.interaction,
          message: { $ref: `#/components/messages/${messageName}` },
        },
      };

      if (entry.meta.parameters) {
        channel.parameters = entry.meta.parameters;
      }

      channels[entry.meta.pattern] = channel;
    }

    return {
      asyncapi: '2.6.0',
      info: {
        title: info.title,
        version: info.version,
        description: info.description,
      },
      defaultContentType: 'application/json',
      servers: {
        rabbitmq: {
          // Placeholder only — never embed real credentials in a committed doc.
          url: 'amqp://{username}:{password}@{host}:5672',
          protocol: 'amqp',
          description:
            'Backend consumes MAIN_QUEUE; each server consumes its own Server.queueName. ' +
            'Inbound (publish) patterns are sent by agents to MAIN_QUEUE; outbound (subscribe) ' +
            'patterns are sent by the backend to the target server queue. ' +
            'Configure the real broker URL via the RABBITMQ_URL environment variable.',
        },
      },
      channels,
      components: { messages, schemas },
    };
  }

  private buildMessage(
    name: string,
    schemaName: string | undefined,
    schemas: Record<string, unknown>,
  ) {
    if (schemaName && schemas[schemaName]) {
      // No schemaFormat: keep payloads as default AsyncAPI schema so parsers
      // resolve the $ref cleanly (schemaFormat + $ref breaks some tooling).
      return {
        name,
        title: name,
        contentType: 'application/json',
        payload: { $ref: `#/components/schemas/${schemaName}` },
      };
    }

    return {
      name,
      title: name,
      contentType: 'application/json',
      payload: { type: 'object' },
    };
  }

  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
}
