import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  client!: Redis;
  available = false;
  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on('error', () => {
      this.available = false;
    });
    try {
      await this.client.connect();
      this.available = (await this.client.ping()) === 'PONG';
    } catch {
      this.available = false;
    }
  }
  async onModuleDestroy() {
    if (this.client?.status === 'ready') await this.client.quit();
  }
}
