import { Injectable } from '@nestjs/common';

export interface InputDescriptor {
  name: string;
  tokenEstimate: number;
  freshness: number;
  priority: 'required' | 'recommended' | 'optional';
}

export interface ContextPlan {
  maxInputTokens: number;
  maxOutputTokens: number;
  includedInputs: string[];
  excludedInputs: string[];
  truncationRules: Record<string, number>;
}

type AgentTask =
  | 'intent_classification'
  | 'news_sentiment'
  | 'technical_signal'
  | 'risk_gate'
  | 'sizing_suggestion'
  | 'macro_context'
  | 'decision_synthesis'
  | 'cross_agent_synthesis';

const TOKEN_DEFAULTS: Record<string, { input: number; output: number }> = {
  intent_classification: { input: 512, output: 256 },
  news_sentiment: { input: 1024, output: 512 },
  technical_signal: { input: 1024, output: 512 },
  risk_gate: { input: 1024, output: 768 },
  sizing_suggestion: { input: 1024, output: 512 },
  macro_context: { input: 1024, output: 512 },
  decision_synthesis: { input: 2048, output: 1024 },
  cross_agent_synthesis: { input: 2048, output: 1024 },
};

@Injectable()
export class ContextPlannerService {
  plan(task: AgentTask, availableInputs: InputDescriptor[]): ContextPlan {
    const defaults = TOKEN_DEFAULTS[task] ?? { input: 1024, output: 512 };

    // Start with base budgets
    let maxInputTokens = defaults.input;
    const maxOutputTokens = defaults.output;

    const includedInputs: string[] = [];
    const excludedInputs: string[] = [];
    const truncationRules: Record<string, number> = {};

    // Sort inputs: required first, then recommended, then optional
    const sorted = [...availableInputs].sort((a, b) => {
      const order = { required: 0, recommended: 1, optional: 2 };
      return order[a.priority] - order[b.priority];
    });

    // Count required tokens to see if we need to scale up
    const requiredTokens = sorted
      .filter((i) => i.priority === 'required')
      .reduce((sum, i) => sum + i.tokenEstimate, 0);

    const recommendedTokens = sorted
      .filter((i) => i.priority === 'recommended')
      .reduce((sum, i) => sum + i.tokenEstimate, 0);

    // Scale up if required inputs alone exceed base budget
    if (requiredTokens > maxInputTokens) {
      maxInputTokens = Math.ceil(requiredTokens * 1.2); // 20% headroom
    }

    // Scale up further if many high-priority inputs
    if (requiredTokens + recommendedTokens > maxInputTokens) {
      maxInputTokens = Math.min(
        requiredTokens + recommendedTokens,
        defaults.input * 4, // hard ceiling: 4x default
      );
    }

    let consumed = 0;

    for (const input of sorted) {
      if (input.priority === 'required') {
        // Always include required — truncate if needed
        const allowance = Math.min(
          input.tokenEstimate,
          maxInputTokens - consumed,
        );
        includedInputs.push(input.name);
        if (allowance < input.tokenEstimate) {
          truncationRules[input.name] = Math.max(allowance, 64);
        }
        consumed += Math.min(input.tokenEstimate, allowance);
      } else if (input.priority === 'recommended') {
        if (consumed + input.tokenEstimate <= maxInputTokens) {
          includedInputs.push(input.name);
          consumed += input.tokenEstimate;
        } else {
          // Try to include with truncation
          const remaining = maxInputTokens - consumed;
          if (remaining >= 64) {
            includedInputs.push(input.name);
            truncationRules[input.name] = remaining;
            consumed += remaining;
          } else {
            excludedInputs.push(input.name);
          }
        }
      } else {
        // optional — only if significant budget remains (>30%)
        const budgetRemaining = maxInputTokens - consumed;
        if (
          budgetRemaining > maxInputTokens * 0.3 &&
          budgetRemaining >= input.tokenEstimate
        ) {
          includedInputs.push(input.name);
          consumed += input.tokenEstimate;
        } else {
          excludedInputs.push(input.name);
        }
      }
    }

    return {
      maxInputTokens,
      maxOutputTokens,
      includedInputs,
      excludedInputs,
      truncationRules,
    };
  }
}
