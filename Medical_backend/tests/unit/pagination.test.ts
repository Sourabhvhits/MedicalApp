import { describe, expect, it } from 'vitest';
import { getPagination, getSort } from '../../src/utils/pagination';
import { buildMeta } from '../../src/utils/response';
import { slugify } from '../../src/utils/slug';
import { entityCode, skuFromName } from '../../src/utils/numbering';

describe('getPagination', () => {
  it('applies defaults', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('computes the offset', () => {
    expect(getPagination({ page: 3, limit: 25 })).toEqual({ page: 3, limit: 25, skip: 50, take: 25 });
  });

  it('clamps hostile input', () => {
    expect(getPagination({ page: -5, limit: 100000 }).page).toBe(1);
    expect(getPagination({ page: 1, limit: 100000 }).limit).toBe(100);
    expect(getPagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });
});

describe('getSort', () => {
  const allowed = ['name', 'createdAt'] as const;

  it('accepts a whitelisted field', () => {
    expect(getSort('name', 'asc', allowed, 'createdAt')).toEqual({ field: 'name', order: 'asc' });
  });

  it('falls back for an unknown field, blocking SQL injection through sortBy', () => {
    expect(getSort('id; DROP TABLE users', 'desc', allowed, 'createdAt').field).toBe('createdAt');
  });
});

describe('buildMeta', () => {
  it('describes a middle page', () => {
    expect(buildMeta(2, 10, 35)).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('handles an empty result set', () => {
    expect(buildMeta(1, 10, 0)).toMatchObject({ totalPages: 0, hasNext: false, hasPrev: false });
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Pain Relief & Fever')).toBe('pain-relief-fever');
    expect(slugify('  Tablets  ')).toBe('tablets');
    expect(slugify('Vitamin D3 60,000 IU')).toBe('vitamin-d3-60-000-iu');
  });
});

describe('document codes', () => {
  it('zero-pads entity codes', () => {
    expect(entityCode('VEN', 45)).toBe('VEN-000045');
    expect(entityCode('CUS', 1)).toBe('CUS-000001');
  });

  it('derives a SKU from the product name', () => {
    expect(skuFromName('Paracetamol 500mg', 1)).toBe('PARACE-000001');
    expect(skuFromName('!!!', 2)).toBe('PROD-000002');
  });
});
