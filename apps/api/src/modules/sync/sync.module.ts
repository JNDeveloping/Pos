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
    let scopedPage = page;
    const hydrated: {
      version: bigint;
      entityType: 'PRODUCT' | 'PRODUCT_BARCODE';
      entityId: string;
      operation: 'UPSERT';
      payload: Prisma.JsonValue;
      createdAt: Date;
    }[] = [];
    if (query.branchId) {
      const productIds = page.filter((row) => row.entityType === 'PRODUCT').map((row) => row.entityId);
      const barcodeProductIds = page
        .filter(
          (row) =>
            row.entityType === 'PRODUCT_BARCODE' &&
            row.payload &&
            typeof row.payload === 'object' &&
            !Array.isArray(row.payload),
        )
        .map((row) => String((row.payload as Prisma.JsonObject).productId));
      const allowed = new Set(
        (
          await this.db.branchProduct.findMany({
            where: {
              branchId: query.branchId,
              enabled: true,
              productId: { in: [...productIds, ...barcodeProductIds] },
            },
            select: { productId: true },
          })
        ).map((item) => item.productId),
      );
      scopedPage = page.filter((row) => {
        if (row.entityType === 'PRODUCT') return allowed.has(row.entityId);
        if (
          row.entityType === 'PRODUCT_BARCODE' &&
          row.payload &&
          typeof row.payload === 'object' &&
          !Array.isArray(row.payload)
        )
          return allowed.has(String((row.payload as Prisma.JsonObject).productId));
        return true;
      });
      const enableEvents = page
        .filter((item) => item.entityType === 'BRANCH_PRODUCT')
        .map((row) => ({ row, payload: row.payload as Prisma.JsonObject | null }))
        .filter(({ payload }) => payload?.enabled === true);
      const products = await this.db.product.findMany({
        where: {
          id: { in: enableEvents.map(({ payload }) => String(payload?.productId)) },
          companyId: session.companyId,
          active: true,
          deletedAt: null,
        },
        include: { barcodes: true },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));
      for (const { row, payload } of enableEvents) {
        const product = productsById.get(String(payload?.productId));
        if (!product) continue;
        const { barcodes, ...productPayload } = product;
        hydrated.push({
          version: row.version,
          entityType: 'PRODUCT',
          entityId: product.id,
          operation: 'UPSERT',
          payload: productPayload as unknown as Prisma.JsonValue,
          createdAt: row.createdAt,
        });
        hydrated.push(
          ...barcodes.map((barcode) => ({
            version: row.version,
            entityType: 'PRODUCT_BARCODE' as const,
            entityId: barcode.id,
            operation: 'UPSERT' as const,
            payload: barcode as unknown as Prisma.JsonValue,
            createdAt: row.createdAt,
          })),
        );
      }
    }
    const changes = [...scopedPage, ...hydrated]
      .sort((a, b) => Number(a.version - b.version))
      .map((row) => ({
        version: row.version.toString(),
        entityType: row.entityType,
        entityId: row.entityId,
        operation: row.operation,
        payload: row.payload,
        createdAt: row.createdAt,
      }));
    return {
      cursor: page.at(-1)?.version.toString() ?? query.cursor,
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
