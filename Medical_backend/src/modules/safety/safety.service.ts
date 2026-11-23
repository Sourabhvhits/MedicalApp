import { prisma } from '../../database/prisma';

export interface InteractionWarning {
  compositionA: string;
  compositionB: string;
  severity: 'LOW' | 'MODERATE' | 'SEVERE';
  description: string;
}

/**
 * Checks every distinct pair of compositions for a known interaction
 * (TASKS.md Priority-1 addition A). Informational — returns a warning list,
 * never blocks the caller itself; checkout decides what to do with a SEVERE
 * result.
 */
export async function checkInteractions(compositions: (string | null)[]): Promise<InteractionWarning[]> {
  const distinct = Array.from(new Set(compositions.filter((c): c is string => Boolean(c && c.trim()))));
  if (distinct.length < 2) return [];

  const rows = await prisma.drugInteraction.findMany({
    where: {
      OR: [
        { compositionA: { in: distinct }, compositionB: { in: distinct } },
        { compositionB: { in: distinct }, compositionA: { in: distinct } },
      ],
    },
    select: { compositionA: true, compositionB: true, severity: true, description: true },
  });

  // A pair could theoretically match both OR branches once each — de-dupe by id-ish key.
  const seen = new Set<string>();
  const warnings: InteractionWarning[] = [];
  for (const row of rows) {
    const key = [row.compositionA, row.compositionB].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push(row);
  }
  return warnings;
}

export const hasSevereInteraction = (warnings: InteractionWarning[]): boolean =>
  warnings.some((warning) => warning.severity === 'SEVERE');
