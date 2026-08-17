import { BadRequestException } from '@nestjs/common';
import { validateAnalysis } from './invoice-analysis.service';
describe('invoice analysis schema', () => {
  it('accepts a strict result', () =>
    expect(
      validateAnalysis({
        document: { number: '1' },
        totals: { total: 10 },
        items: [{ description: 'ITEM', total: 10 }],
        warnings: [],
      }),
    ).toBeTruthy());
  it('rejects free text', () => expect(() => validateAnalysis('invoice')).toThrow(BadRequestException));
  it('rejects lines without descriptions', () =>
    expect(() => validateAnalysis({ document: {}, totals: { total: 1 }, items: [{}], warnings: [] })).toThrow());
});
