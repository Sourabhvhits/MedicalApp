export interface DrugInteractionWarning {
  compositionA: string;
  compositionB: string;
  severity: 'LOW' | 'MODERATE' | 'SEVERE';
  description: string;
}

export interface SafetyBannerProps {
  warnings: DrugInteractionWarning[];
}
