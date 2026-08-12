import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';

@ApiTags('Salud')
@Controller('health')
class HealthController {
  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const startedAt = Date.now();
    await this.db.$queryRaw`SELECT 1`;
    let redis = 'unavailable';
    if (this.redis.available) {
      try {
        redis = (await this.redis.client.ping()) === 'PONG' ? 'ok' : 'error';
      } catch {
        redis = 'unavailable';
      }
    }
    return {
      status: redis === 'ok' ? 'ok' : 'degraded',
      database: 'ok',
      redis,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
