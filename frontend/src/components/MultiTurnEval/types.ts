import { MetricResultEntry, TokenUsage } from '../LLMEval/types';

export type TurnRole = 'user' | 'assistant';

export interface TurnInput {
  role: TurnRole;
  content: string;
}

export type MultiTurnMetricOption = 'conversation_completeness';

export interface MultiTurnFormState {
  turns: TurnInput[];
  metric: MultiTurnMetricOption[];
}

export interface MultiTurnResponse {
  metric?: string;
  metric_name?: string;
  score?: number;
  verdict?: string;
  explanation?: string;
  allMetrics?: boolean;
  totalMetrics?: number;
  results?: MetricResultEntry[];
  turns?: TurnInput[];
  usage?: TokenUsage | null;
  totalUsage?: TokenUsage | null;
}

export interface MultiTurnValidationErrors {
  turns?: string;
  metric?: string;
}
