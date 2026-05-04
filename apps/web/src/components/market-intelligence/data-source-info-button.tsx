import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { TabModal } from '@crypto-trader/ui';
import type { TabModalTab } from '@crypto-trader/ui';

interface DataSourceInfoButtonProps {
  title: string;
  tabs: TabModalTab[];
}

/**
 * Renders a small info (ℹ️) icon button that opens a TabModal
 * with explanations of the card's indicators and agent usage.
 */
export function DataSourceInfoButton({
  title,
  tabs,
}: DataSourceInfoButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label={`Info: ${title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <TabModal
          icon={Info}
          title={title}
          subtitle={t('marketIntelligence.info.modal.subtitle')}
          tabs={tabs}
          onClose={() => setOpen(false)}
          closeLabel={t('marketIntelligence.info.modal.close')}
        />
      )}
    </>
  );
}
