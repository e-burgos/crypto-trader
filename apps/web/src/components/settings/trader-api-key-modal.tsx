import { useState } from 'react';
import { Dialog, Input, Button } from '@crypto-trader/ui';
import { Key } from 'lucide-react';
import { useSetTraderCredential } from '../../hooks/use-trader-data-sources';

interface TraderApiKeyModalProps {
  sourceId: string;
  sourceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TraderApiKeyModal({
  sourceId,
  sourceName,
  onClose,
  onSuccess,
}: TraderApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const { mutate: setCredential, isPending } = useSetTraderCredential();

  function handleSave() {
    if (!apiKey.trim()) return;
    setCredential(
      { id: sourceId, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Set API Key — ${sourceName}`}
      variant="default"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <Key className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Enter your personal API key for {sourceName}. This key will be
              used exclusively for your account and will override any
              admin-shared key.
            </p>
          </div>
        </div>

        <Input
          type="password"
          placeholder="Paste your API key here..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!apiKey.trim() || isPending}
          >
            {isPending ? 'Saving...' : 'Save Key'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
