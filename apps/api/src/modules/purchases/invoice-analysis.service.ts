import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { normalizeSupplierText } from '../suppliers/suppliers.module';

export type AnalysisItem = {
  description: string;
  supplierCode?: string;
  barcode?: string;
  packagesQuantity?: number;
  unitsPerCase?: number;
  totalUnits?: number;
  unitCost?: number;
  discountPercent?: number;
  taxRate?: number;
  subtotal?: number;
  total?: number;
  confidence?: number;
};
export type InvoiceAnalysisResult = {
  supplier?: { name?: string; cuit?: string; confidence?: number };
  document: { type?: string; number?: string; date?: string };
  totals: { subtotal?: number; discount?: number; tax?: number; otherCharges?: number; total: number };
  items: AnalysisItem[];
  warnings: string[];
};
export interface InvoiceAnalyzer {
  readonly name: string;
  analyze(input: { mimeType: string; text?: string; storageKey: string }): Promise<unknown>;
}
@Injectable()
export class ManualInvoiceAnalyzer implements InvoiceAnalyzer {
  readonly name = 'manual';
  async analyze(_input: { mimeType: string; text?: string; storageKey: string }) {
    return {
      document: {},
      totals: { total: 0 },
      items: [],
      warnings: ['El proveedor IA/OCR no está configurado. Complete la factura manualmente.'],
    };
  }
}
export function validateAnalysis(value: unknown): InvoiceAnalysisResult {
  if (!value || typeof value !== 'object') throw new BadRequestException('Resultado IA inválido');
  const x = value as Record<string, unknown>;
  if (!x.document || !x.totals || !Array.isArray(x.items) || !Array.isArray(x.warnings))
    throw new BadRequestException('El análisis no cumple el esquema requerido');
  const totals = x.totals as Record<string, unknown>;
  if (typeof totals.total !== 'number' || !Number.isFinite(totals.total))
    throw new BadRequestException('Total de factura inválido');
  if (x.items.length > 500) throw new BadRequestException('La factura supera 500 líneas');
  for (const item of x.items as Record<string, unknown>[])
    if (typeof item.description !== 'string' || !item.description.trim())
      throw new BadRequestException('Cada línea requiere descripción');
  return value as InvoiceAnalysisResult;
}
@Injectable()
export class InvoiceAnalysisService {
  constructor(
    private db: PrismaService,
    private analyzer: ManualInvoiceAnalyzer,
  ) {}
  async analyze(
    companyId: string,
    supplierId: string | undefined,
    input: { mimeType: string; storageKey: string; text?: string },
  ) {
    const parsed = validateAnalysis(await this.analyzer.analyze(input));
    return this.analyzeStructured(companyId, supplierId, parsed);
  }
  async analyzeStructured(companyId: string, supplierId: string | undefined, value: unknown) {
    const parsed = validateAnalysis(value);
    let detected = supplierId ? await this.db.supplier.findFirst({ where: { id: supplierId, companyId } }) : undefined;
    if (!detected && parsed.supplier?.cuit)
      detected =
        (await this.db.supplier.findFirst({ where: { companyId, cuit: parsed.supplier.cuit, deletedAt: null } })) ??
        undefined;
    if (!detected && parsed.supplier?.name)
      detected =
        (await this.db.supplier.findFirst({
          where: { companyId, name: { contains: parsed.supplier.name, mode: 'insensitive' }, deletedAt: null },
        })) ?? undefined;
    const items = [];
    for (let i = 0; i < parsed.items.length; i++) {
      const raw = parsed.items[i];
      const match = detected ? await this.match(companyId, detected.id, raw) : undefined;
      items.push({
        lineNumber: i + 1,
        rawDescription: raw.description,
        supplierCode: raw.supplierCode,
        barcode: raw.barcode,
        packagesQuantity: raw.packagesQuantity,
        unitsPerCase: raw.unitsPerCase,
        totalUnits: raw.totalUnits,
        unitCost: raw.unitCost,
        discountPercent: raw.discountPercent,
        taxRate: raw.taxRate,
        subtotal: raw.subtotal,
        total: raw.total,
        matchedProductId: match?.productId,
        confidence: match?.confidence ?? raw.confidence,
        status: match ? InvoiceItemStatus.MATCHED : InvoiceItemStatus.NOT_FOUND,
        candidates: match?.candidates as Prisma.InputJsonValue | undefined,
      });
    }
    const itemSum = parsed.items.reduce((a, x) => a + (x.total ?? x.subtotal ?? 0), 0);
    const expected =
      itemSum + (parsed.totals.tax ?? 0) + (parsed.totals.otherCharges ?? 0) - (parsed.totals.discount ?? 0);
    const warnings = [...parsed.warnings];
    if (Math.abs(expected - parsed.totals.total) > 0.02)
      warnings.push(`Diferencia de totales: ${Math.abs(expected - parsed.totals.total).toFixed(2)}`);
    return { parsed, supplier: detected, items, warnings };
  }
  private async match(companyId: string, supplierId: string, item: AnalysisItem) {
    if (item.supplierCode) {
      const x = await this.db.supplierProduct.findFirst({
        where: { supplierId, supplierCode: item.supplierCode, product: { companyId, deletedAt: null } },
      });
      if (x) return { productId: x.productId, confidence: 1, candidates: [] };
    }
    if (item.barcode) {
      const x = await this.db.productBarcode.findFirst({ where: { companyId, barcode: item.barcode } });
      if (x) return { productId: x.productId, confidence: 1, candidates: [] };
    }
    const normalized = normalizeSupplierText(item.description);
    const alias = await this.db.supplierProductAlias.findUnique({
      where: { supplierId_normalizedDescription: { supplierId, normalizedDescription: normalized } },
    });
    if (alias) return { productId: alias.productId, confidence: Number(alias.confidence ?? 0.98), candidates: [] };
    const direct = await this.db.supplierProduct.findFirst({
      where: {
        supplierId,
        supplierDescription: { equals: item.description, mode: 'insensitive' },
        product: { companyId },
      },
    });
    if (direct) return { productId: direct.productId, confidence: 0.95, candidates: [] };
    const words = normalized
      .split(' ')
      .filter((x) => x.length > 2)
      .slice(0, 3);
    const candidates = await this.db.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: words.map((name) => ({ name: { contains: name, mode: 'insensitive' } })),
      },
      select: { id: true, name: true, internalCode: true },
      take: 3,
    });
    return candidates.length === 1 ? { productId: candidates[0].id, confidence: 0.65, candidates } : undefined;
  }
}
