import { optionalBoolean } from './products.module';

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
