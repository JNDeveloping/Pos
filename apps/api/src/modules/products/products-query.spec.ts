import type { Session } from '../../common/auth';
import { optionalBoolean, ProductsController } from './products.module';

describe('product query normalization', () => {
  it('keeps omitted optional filters undefined', () => {
    expect(optionalBoolean({ value: undefined })).toBeUndefined();
    expect(optionalBoolean({ value: '' })).toBeUndefined();
  });
  it('handles values before and after implicit conversion', () => {
    expect(optionalBoolean({ value: 'true' })).toBe(true);
    expect(optionalBoolean({ value: true })).toBe(true);
    expect(optionalBoolean({ value: 'false' })).toBe(false);
    expect(optionalBoolean({ value: false })).toBe(false);
  });
});

describe('product pagination', () => {
  it('filters on the server and never fetches the complete catalog', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const db = {
      product: { findMany, count: jest.fn().mockResolvedValue(50000) },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const session: Session = { sub: 'u', companyId: 'c', branchId: null, roles: [], permissions: ['products.view'], tokenVersion: 0 };
    const controller = new ProductsController(db as never);
    const result = await controller.list(session, {
      page: 125,
      limit: 20,
      search: 'yerba',
      familyId: '00000000-0000-4000-8000-000000000001',
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2480, take: 20 }));
    expect(findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      companyId: 'c',
      familyId: '00000000-0000-4000-8000-000000000001',
    }));
    expect(result.meta).toEqual(expect.objectContaining({ total: 50000, pages: 2500 }));
  });
});
