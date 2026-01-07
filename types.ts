
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
      technical_delta: string; // The exact phrasing added/changed
      evidence_link: string; // Link to specific spec paragraph found by agent
    };
    strategy_evaluation: {
      best_matching_strategy_name: string;
      prediction_accuracy: 'Exact Match' | 'Concept Match' | 'Partial Match' | 'Miss';
      match_analysis: string;
      retrieval_success_rate: number; // 0-100 score for how well it found the spec info
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
