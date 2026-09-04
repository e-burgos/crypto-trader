import { useTranslation } from 'react-i18next';
import { ENTRY_ORDER_STATUSES, type TradingConfigWire } from '@crypto-trader/shared';
import { FilterPills, Select, type FilterPill, type SelectOption } from '@crypto-trader/ui';
import type { EntryOrdersFilters as EntryOrdersFiltersState } from '../../../hooks/use-entry-orders';
import { hasKnownConfig, resolveBotLabel } from './entry-order-labels';

interface EntryOrdersFiltersProps {
  filters: EntryOrdersFiltersState;
  configs: TradingConfigWire[];
  onChange: (filters: EntryOrdersFiltersState) => void;
}

export function EntryOrdersFilters({ filters, configs, onChange }: EntryOrdersFiltersProps) {
  const { t } = useTranslation();

  const statusOptions: FilterPill[] = [
    { value: 'ALL', label: t('positions.entries.filters.statusAll') },
    ...ENTRY_ORDER_STATUSES.map((status) => ({
      value: status,
      label: t(`positions.entries.status.${status}`),
    })),
  ];

  const botOptions: SelectOption[] = [
    { value: 'ALL', label: t('positions.entries.filters.botAll') },
    ...configs.map((cfg) => ({ value: cfg.id, label: resolveBotLabel(cfg.id, configs) })),
  ];
  if (filters.configId !== 'ALL' && !hasKnownConfig(filters.configId, configs)) {
    botOptions.push({ value: filters.configId, label: filters.configId });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">
          {t('positions.entries.filters.statusLabel')}
        </span>
        <FilterPills
          options={statusOptions}
          value={filters.status}
          onChange={(value) =>
            onChange({ ...filters, status: value as EntryOrdersFiltersState['status'] })
          }
        />
      </div>
      <Select
        label={t('positions.entries.filters.botLabel')}
        options={botOptions}
        value={filters.configId}
        onChange={(value) => onChange({ ...filters, configId: value })}
        className="sm:max-w-xs"
      />
    </div>
  );
}
