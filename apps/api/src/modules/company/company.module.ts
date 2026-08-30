import { BadRequestException, Body, Controller, ForbiddenException, Get, Module, NotFoundException, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
@Controller('company')
class CompanyController {
  constructor(private db: PrismaService) {}
  @Get() get(@CurrentSession() s: Session) {
    return this.db.company.findUniqueOrThrow({ where: { id: s.companyId } });
  }
}
@Controller('settings')
export class SettingsController {
  constructor(private db: PrismaService) {}
  private async validateBranch(s: Session, branchId?: string) {
    if (!branchId) return;
    if (s.branchId && s.branchId !== branchId) throw new ForbiddenException('No puede configurar otra sucursal');
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, companyId: s.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
  }
  @Post('pos-background') @RequirePermissions('branches.settings')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async uploadBackground(@CurrentSession() s: Session, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Seleccione una imagen');
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Use una imagen JPG, PNG o WebP');
    const validSignature =
      (extension === 'jpg' && file.buffer[0] === 0xff && file.buffer[1] === 0xd8) ||
      (extension === 'png' && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (extension === 'webp' && file.buffer.subarray(0, 4).toString() === 'RIFF' && file.buffer.subarray(8, 12).toString() === 'WEBP');
    if (!validSignature) throw new BadRequestException('El archivo no contiene una imagen válida');
    const directory = resolve(process.cwd(), 'uploads/public/pos-backgrounds', s.companyId);
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(resolve(directory, filename), file.buffer, { flag: 'wx' });
    return { url: `/api/uploads/pos-backgrounds/${s.companyId}/${filename}` };
  }
  @Get() @RequirePermissions('branches.settings') async get(
    @CurrentSession() s: Session,
    @Query('branchId') branchId?: string,
  ) {
    await this.validateBranch(s, branchId);
    const [company, branch] = await Promise.all([
      this.db.companySetting.findMany({ where: { companyId: s.companyId } }),
      branchId ? this.db.branchSetting.findMany({ where: { companyId: s.companyId, branchId } }) : [],
    ]);
    return Object.fromEntries([...company, ...branch].map((x) => [x.key, x.value]));
  }
  @Put() @RequirePermissions('branches.settings') async put(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    await this.validateBranch(s, branchId);
    return this.db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(body)) {
        if (branchId)
          await tx.branchSetting.upsert({
            where: { branchId_key: { branchId, key } },
            create: { companyId: s.companyId, branchId, key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          });
        else
          await tx.companySetting.upsert({
            where: { companyId_key: { companyId: s.companyId, key } },
            create: { companyId: s.companyId, key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          });
      }
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          branchId,
          userId: s.sub,
          entityType: 'SETTING',
          entityId: branchId ?? s.companyId,
          action: 'SETTINGS_UPDATED',
          metadata: { keys: Object.keys(body) },
        },
      });
      return body;
    });
  }
}
@Module({ controllers: [CompanyController, SettingsController] })
export class CompanyModule {}
