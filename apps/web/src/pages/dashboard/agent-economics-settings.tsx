import { useState } from 'react';
import { Settings2, DollarSign, ShieldCheck } from 'lucide-react';
import {
  useAgentBudgetPolicies,
  useUpdateBudgetPolicy,
  type BudgetPolicy,
} from '../../hooks/use-agent-budget-policies';
import { Card, Spinner, EmptyState, Button, Input, ToggleSwitch } from '@crypto-trader/ui';

interface EditingState {
  [agentId: string]: Partial<BudgetPolicy>;
}

export function AgentEconomicsSettingsPage() {
  const { data: policies, isLoading } = useAgentBudgetPolicies();
  const updateMutation = useUpdateBudgetPolicy();
  const [editing, setEditing] = useState<EditingState>({});

  const handleFieldChange = (
    agentId: string,
    field: keyof BudgetPolicy,
    value: number | boolean,
  ) => {
    setEditing((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  };

  const handleSave = (agentId: string) => {
    const changes = editing[agentId];
    if (!changes) return;
    updateMutation.mutate(
      { agentId, ...changes },
      {
        onSuccess: () => {
          setEditing((prev) => {
            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        },
      },
    );
  };

  const getDisplayValue = (
    policy: BudgetPolicy,
    field: keyof BudgetPolicy,
  ) => {
    const editVal = editing[policy.agentId]?.[field];
    return editVal !== undefined ? editVal : policy[field];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Agent Economics</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure budget policies and spending limits for each agent.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : !policies || policies.length === 0 ? (
        <EmptyState
          title="No budget policies"
          description="Budget policies will appear here once agents have been configured."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((policy) => {
            const hasChanges = !!editing[policy.agentId];
            return (
              <Card key={policy.agentId} className="p-5 space-y-4">
                {/* Agent Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold capitalize">
                    {policy.agentId}
                  </h3>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Max Daily USD */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Max Daily USD
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={String(
                      getDisplayValue(policy, 'maxDailyUsd'),
                    )}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.agentId,
                        'maxDailyUsd',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </div>

                {/* Max Cost Per Decision */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Max Cost / Decision
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={String(
                      getDisplayValue(policy, 'maxCostPerDecisionUsd'),
                    )}
                    onChange={(e) =>
                      handleFieldChange(
                        policy.agentId,
                        'maxCostPerDecisionUsd',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </div>

                {/* Block Free Models */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Block Free Models
                  </label>
                  <ToggleSwitch
                    checked={
                      getDisplayValue(policy, 'blockFreeModels') as boolean
                    }
                    onChange={(val) =>
                      handleFieldChange(
                        policy.agentId,
                        'blockFreeModels',
                        val,
                      )
                    }
                  />
                </div>

                {/* Save Button */}
                {hasChanges && (
                  <Button
                    size="sm"
                    onClick={() => handleSave(policy.agentId)}
                    disabled={updateMutation.isPending}
                    className="w-full"
                  >
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}

                {/* Last updated */}
                <p className="text-xs text-muted-foreground">
                  Updated:{' '}
                  {new Date(policy.updatedAt).toLocaleDateString()}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
