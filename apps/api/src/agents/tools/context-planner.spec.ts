import { ContextPlannerService, InputDescriptor } from './context-planner.service';

describe('ContextPlannerService', () => {
  const planner = new ContextPlannerService();

  it('returns correct token budgets per task type', () => {
    const plan = planner.plan('intent_classification', []);
    expect(plan.maxInputTokens).toBe(512);
    expect(plan.maxOutputTokens).toBe(256);

    const synthPlan = planner.plan('decision_synthesis', []);
    expect(synthPlan.maxInputTokens).toBe(2048);
    expect(synthPlan.maxOutputTokens).toBe(1024);
  });

  it('includes required inputs and excludes optional when over budget', () => {
    const inputs: InputDescriptor[] = [
      { name: 'portfolio', tokenEstimate: 300, freshness: 0, priority: 'required' },
      { name: 'indicators', tokenEstimate: 200, freshness: 0, priority: 'recommended' },
      { name: 'news', tokenEstimate: 500, freshness: 0, priority: 'optional' },
    ];

    // intent_classification has base 512 input tokens
    const plan = planner.plan('intent_classification', inputs);

    expect(plan.includedInputs).toContain('portfolio');
    expect(plan.includedInputs).toContain('indicators');
    // news is optional and portfolio(300)+indicators(200)=500, leaves only 12 tokens
    // which is < 30% of 512 = 153.6, so optional should be excluded
    expect(plan.excludedInputs).toContain('news');
  });

  it('scales up maxInputTokens when required inputs exceed base budget', () => {
    const inputs: InputDescriptor[] = [
      { name: 'positions', tokenEstimate: 400, freshness: 0, priority: 'required' },
      { name: 'wallets', tokenEstimate: 300, freshness: 0, priority: 'required' },
    ];

    // intent_classification base = 512, but required = 700
    const plan = planner.plan('intent_classification', inputs);

    expect(plan.maxInputTokens).toBeGreaterThanOrEqual(700);
    expect(plan.includedInputs).toContain('positions');
    expect(plan.includedInputs).toContain('wallets');
  });

  it('truncates recommended inputs when budget is tight', () => {
    const inputs: InputDescriptor[] = [
      { name: 'portfolio', tokenEstimate: 400, freshness: 0, priority: 'required' },
      { name: 'indicators', tokenEstimate: 300, freshness: 0, priority: 'recommended' },
    ];

    // intent_classification base = 512
    // portfolio takes 400, the planner may scale up to fit indicators
    const plan = planner.plan('intent_classification', inputs);

    expect(plan.includedInputs).toContain('portfolio');
    // indicators should be included (planner scales up or truncates)
    expect(plan.includedInputs).toContain('indicators');
  });

  it('uses default budgets for unknown task types', () => {
    const plan = planner.plan('unknown_task' as any, []);
    expect(plan.maxInputTokens).toBe(1024);
    expect(plan.maxOutputTokens).toBe(512);
  });
});
