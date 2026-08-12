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
    const redis = await this.redis.client.ping();
    return {
      status: 'ok',
      database: 'ok',
      redis: redis === 'PONG' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
