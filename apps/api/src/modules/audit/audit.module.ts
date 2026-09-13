import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

class AuditQuery {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}
@Controller('audit')
class AuditController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('audit.view') async list(@CurrentSession() s: Session, @Query() q: AuditQuery) {
    const where = { companyId: s.companyId, ...(q.action ? { action: q.action } : {}), ...(q.entityType ? { entityType: q.entityType } : {}), ...(s.branchId ? { branchId: s.branchId } : q.branchId ? { branchId: q.branchId } : {}), ...(q.userId ? { userId: q.userId } : {}), ...(q.from ? { createdAt: { gte: new Date(q.from) } } : {}) };
    const [data, total] = await this.db.$transaction([
      this.db.auditLog.findMany({ where, include: { user: { select: { firstName: true, lastName: true, username: true } }, branch: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.db.auditLog.count({ where }),
    ]);
    return { data, meta: { page: q.page, total, pages: Math.ceil(total / q.limit) } };
  }
}
class LabelDto { @IsArray() @ArrayMaxSize(100) @IsUUID('4', { each: true }) productIds!: string[]; @IsString() template!: string; @IsUUID() branchId!: string; }
class PrintedLabelsDto { @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) ids!: string[]; }
@Controller('labels')
class LabelsController {
  constructor(private db: PrismaService) {}
  @Post('generated') @RequirePermissions('labels.generate') async generated(@CurrentSession() s: Session, @Body() dto: LabelDto) {
    const branch = await this.db.branch.findFirst({ where: { id: dto.branchId, companyId: s.companyId } });
    if (!branch || (s.branchId && s.branchId !== dto.branchId)) return { generated: 0 };
    await this.db.auditLog.create({ data: { companyId: s.companyId, branchId: dto.branchId, userId: s.sub, entityType: 'BRANCH', entityId: dto.branchId, action: 'LABEL_GENERATED', metadata: { template: dto.template, productIds: dto.productIds } } });
    return { generated: dto.productIds.length };
  }
  @Get('pending') @RequirePermissions('labels.view') async pending(
    @CurrentSession() s: Session,
    @Query('branchId') branchId?: string,
  ) {
    const effectiveBranch = s.branchId ?? branchId;
    if (!effectiveBranch) return [];
    return this.db.labelPrintQueue.findMany({
      where: { companyId: s.companyId, branchId: effectiveBranch, status: 'PENDING' },
      include: {
        product: { select: { id: true, name: true, internalCode: true, taxRate: true, unitType: true, isWeighted: true, netContent: true, netContentUnit: true, category: { select: { name: true } }, barcodes: { take: 1, orderBy: { isPrimary: 'desc' } } } },
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }
  @Post('pending/printed') @RequirePermissions('labels.generate') async printed(
    @CurrentSession() s: Session,
    @Body() dto: PrintedLabelsDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.labelPrintQueue.findMany({
        where: { id: { in: dto.ids }, companyId: s.companyId, branchId: s.branchId ?? undefined, status: 'PENDING' },
      });
      await tx.labelPrintQueue.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: 'PRINTED', printedAt: new Date() } });
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId: rows[0]?.branchId, userId: s.sub, entityType: 'LABEL_QUEUE', entityId: rows[0]?.id ?? s.companyId, action: 'PRICE_LABELS_PRINTED', metadata: { count: rows.length } } });
      return { printed: rows.length };
    });
  }
}
@Module({ controllers: [AuditController, LabelsController] })
export class AuditModule {}
