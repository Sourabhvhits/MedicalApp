import { describe, expect, it } from 'vitest';
import { aggregateTax, computeLineTax, isInterState } from '../../src/utils/tax';

describe('computeLineTax', () => {
  it('extracts GST from a tax-inclusive retail price', () => {
    // ₹112 inclusive of 12% GST => ₹100 taxable + ₹12 tax
    const line = computeLineTax({
      unitPrice: 112,
      quantity: 1,
      gstRate: 12,
      priceIncludesTax: true,
    });

    expect(line.taxableAmount.toNumber()).toBe(100);
    expect(line.taxAmount.toNumber()).toBe(12);
    expect(line.totalAmount.toNumber()).toBe(112);
  });

  it('adds GST on top of a tax-exclusive wholesale price', () => {
    const line = computeLineTax({
      unitPrice: 100,
      quantity: 2,
      gstRate: 12,
      priceIncludesTax: false,
    });

    expect(line.taxableAmount.toNumber()).toBe(200);
    expect(line.taxAmount.toNumber()).toBe(24);
    expect(line.totalAmount.toNumber()).toBe(224);
  });

  it('applies the discount before tax is computed', () => {
    const line = computeLineTax({
      unitPrice: 100,
      quantity: 1,
      gstRate: 10,
      discountPct: 10,
      priceIncludesTax: false,
    });

    expect(line.discountAmount.toNumber()).toBe(10);
    expect(line.taxableAmount.toNumber()).toBe(90);
    expect(line.taxAmount.toNumber()).toBe(9);
    expect(line.totalAmount.toNumber()).toBe(99);
  });

  it('splits intra-state tax into CGST and SGST', () => {
    const line = computeLineTax({
      unitPrice: 100,
      quantity: 1,
      gstRate: 18,
      priceIncludesTax: false,
      interState: false,
    });

    expect(line.cgstAmount.toNumber()).toBe(9);
    expect(line.sgstAmount.toNumber()).toBe(9);
    expect(line.igstAmount.toNumber()).toBe(0);
  });

  it('charges IGST on an inter-state supply', () => {
    const line = computeLineTax({
      unitPrice: 100,
      quantity: 1,
      gstRate: 18,
      priceIncludesTax: false,
      interState: true,
    });

    expect(line.igstAmount.toNumber()).toBe(18);
    expect(line.cgstAmount.toNumber()).toBe(0);
    expect(line.sgstAmount.toNumber()).toBe(0);
  });

  it('keeps CGST + SGST exactly equal to the total tax when it is an odd amount', () => {
    // 5% of 100.10 = 5.005 -> 5.01, which cannot be split evenly.
    const line = computeLineTax({
      unitPrice: 100.1,
      quantity: 1,
      gstRate: 5,
      priceIncludesTax: false,
    });

    const split = line.cgstAmount.add(line.sgstAmount);
    expect(split.toNumber()).toBe(line.taxAmount.toNumber());
  });

  it('never loses a paisa across a multi-line order', () => {
    const lines = [
      computeLineTax({ unitPrice: 33.33, quantity: 3, gstRate: 12, priceIncludesTax: true }),
      computeLineTax({ unitPrice: 19.99, quantity: 7, gstRate: 5, priceIncludesTax: true }),
      computeLineTax({ unitPrice: 145.5, quantity: 1, gstRate: 18, priceIncludesTax: true }),
    ];

    const totals = aggregateTax(lines);
    const recomputed = totals.taxableAmount.add(totals.taxAmount);

    expect(recomputed.toNumber()).toBeCloseTo(totals.totalAmount.toNumber(), 2);
    expect(totals.cgstAmount.add(totals.sgstAmount).toNumber()).toBeCloseTo(
      totals.taxAmount.toNumber(),
      2,
    );
  });

  it('treats a zero-rated product as fully taxable with no tax', () => {
    const line = computeLineTax({ unitPrice: 50, quantity: 2, gstRate: 0, priceIncludesTax: true });

    expect(line.taxAmount.toNumber()).toBe(0);
    expect(line.taxableAmount.toNumber()).toBe(100);
    expect(line.totalAmount.toNumber()).toBe(100);
  });
});

describe('isInterState', () => {
  it('compares the state code prefix of two GSTINs', () => {
    expect(isInterState('27AAACM1234A1Z7', '27AABCU9603R1ZX')).toBe(false);
    expect(isInterState('27AAACM1234A1Z7', '29AABCU9603R1ZX')).toBe(true);
  });

  it('defaults to intra-state when a GSTIN is missing', () => {
    expect(isInterState(null, '27AABCU9603R1ZX')).toBe(false);
    expect(isInterState('27AAACM1234A1Z7', undefined)).toBe(false);
  });
});
