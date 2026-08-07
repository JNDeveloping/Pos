import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

class ChangesQuery {
  @IsOptional() @IsNumberString({ no_symbols: true }) cursor = '0';
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit = 500;
}

class SyncOperationDto {
  @IsUUID() operationId!: string;
  @IsUUID() entityId!: string;
  @IsString() entityType!: string;
  @IsString() operation!: string;
  @IsObject() payload!: Record<string, unknown>;
}
class PushOperationsDto {
  @IsUUID() deviceId!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}

@ApiTags('Sincronización offline')
@Controller('sync')
class SyncController {
  constructor(private readonly db: PrismaService) {}

  @Get('changes')
  @RequirePermissions('products.view')
  async changes(@CurrentSession() session: Session, @Query() query: ChangesQuery) {
    if (query.branchId) {
      await this.db.branch.findFirstOrThrow({
        where: { id: query.branchId, companyId: session.companyId, deletedAt: null },
      });
    }
    const rows = await this.db.syncChange.findMany({
      where: {
        companyId: session.companyId,
        version: { gt: BigInt(query.cursor) },
        ...(query.branchId ? { OR: [{ branchId: null }, { branchId: query.branchId }] } : {}),
      },
      orderBy: { version: 'asc' },
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const changes = page.map((row) => ({
      version: row.version.toString(),
      entityType: row.entityType,
      entityId: row.entityId,
      operation: row.operation,
      payload: row.payload,
      createdAt: row.createdAt,
    }));
    return {
      cursor: changes.at(-1)?.version ?? query.cursor,
      hasMore,
      changes,
      serverTime: new Date().toISOString(),
    };
  }

  @Post('operations')
  async operations(@CurrentSession() session: Session, @Body() dto: PushOperationsDto) {
    const results = [];
    for (const operation of dto.operations) {
      if (operation.entityType !== 'DEVICE_METADATA') {
        results.push({
          operationId: operation.operationId,
          status: 'UNSUPPORTED',
          error: 'La etapa actual sólo acepta metadatos del dispositivo',
        });
        continue;
      }
      const existing = await this.db.syncOperation.findUnique({
        where: { companyId_operationId: { companyId: session.companyId, operationId: operation.operationId } },
      });
      if (existing) {
        results.push({ operationId: operation.operationId, status: 'ALREADY_PROCESSED', result: existing.result });
        continue;
      }
      // Stage 1 has no offline domain writes. Never acknowledge a future domain
      // command before its transactional handler exists: that could lose a sale.
      const result: Prisma.InputJsonValue = { accepted: true, handler: 'DEVICE_METADATA' };
      await this.db.syncOperation.create({
        data: {
          companyId: session.companyId,
          deviceId: dto.deviceId,
          operationId: operation.operationId,
          entityId: operation.entityId,
          entityType: operation.entityType,
          operation: operation.operation,
          payload: operation.payload as Prisma.InputJsonValue,
          result,
        },
      });
      results.push({ operationId: operation.operationId, status: 'PROCESSED', result });
    }
    return { results };
  }
}

@Module({ controllers: [SyncController] })
export class SyncModule {}
