import { Prisma } from '@prisma/client';

export type Numeric = Prisma.Decimal | number | string;

export const D = (value: Numeric): Prisma.Decimal => new Prisma.Decimal(value ?? 0);

/** Rounds to 2 decimals (half-up) — the rounding used for all money fields. */
export const round2 = (value: Numeric): Prisma.Decimal =>
  D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const sum = (values: Numeric[]): Prisma.Decimal =>
  values.reduce<Prisma.Decimal>((acc, v) => acc.add(D(v)), D(0));

export const toNumber = (value: Numeric | null | undefined): number =>
  value === null || value === undefined ? 0 : D(value).toNumber();

export const isZero = (value: Numeric): boolean => D(value).isZero();
