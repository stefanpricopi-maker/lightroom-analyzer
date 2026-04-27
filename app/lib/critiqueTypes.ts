export type CritiqueIssueCategory =
  | "Exposure"
  | "White Balance"
  | "Contrast"
  | "Color"
  | "Highlights"
  | "Shadows"
  | "Sharpness"
  | "Noise"
  | "Composition";

export type CritiqueSeverity = "critical" | "warning" | "suggestion";

export type CritiquePanel = "Light" | "Color" | "Detail" | "Effects";

export interface CritiqueAdjustment {
  parameter: string;
  value: number;
  reason: string;
}

export interface CritiqueFix {
  panel: CritiquePanel;
  adjustments: CritiqueAdjustment[];
}

export interface CritiqueIssue {
  category: CritiqueIssueCategory;
  severity: CritiqueSeverity;
  title: string;
  description: string;
  fix: CritiqueFix;
}

export interface CritiqueResult {
  overall_score: number;
  summary: string;
  issues: CritiqueIssue[];
  strengths: string[];
  priority_fixes: string[];
}

