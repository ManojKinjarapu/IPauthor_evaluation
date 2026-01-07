
export interface PatentCase {
  appNumber: string;
  originalClaims: string;
  officeActionSummary: string;
  generatedStrategies: string;
  specification: string;
  grantedClaims?: string;
}

export interface AuditResult {
  appNumber: string;
  evaluation_result: {
    winning_amendment: {
      summary: string;
      source_type: 'Dependent Claim' | 'Specification' | 'Argument Only' | 'New Matter';
      source_details: string;
    };
    strategy_evaluation: {
      best_matching_strategy_name: string;
      prediction_accuracy: 'Exact Match' | 'Concept Match' | 'Partial Match' | 'Miss';
      match_analysis: string;
    };
    final_score: number;
    auditor_reasoning: string;
  };
  roi_metrics: {
    cost_saved: number;
    hours_saved: number;
    avoided_second_oa: boolean;
  };
}

export interface BatchSummary {
  totalApps: number;
  avgScore: number;
  totalSavings: number;
  totalHours: number;
  accuracyDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
}
