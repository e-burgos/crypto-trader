// Utils
export { cn } from './lib/utils';

// Primitives
export { Button } from './lib/primitives/button';
export type { ButtonProps } from './lib/primitives/button';
export { Input } from './lib/primitives/input';
export type { InputProps } from './lib/primitives/input';
export { Badge } from './lib/primitives/badge';
export type { BadgeProps, BadgeVariant } from './lib/primitives/badge';
export { InfoTooltip } from './lib/primitives/info-tooltip';
export type { InfoTooltipProps } from './lib/primitives/info-tooltip';
export { Typography } from './lib/primitives/typography';
export type {
  TypographyProps,
  TypographyVariant,
  TypographyWeight,
  TypographyColor,
} from './lib/primitives/typography';
export { Spinner } from './lib/primitives/spinner';
export type { SpinnerProps } from './lib/primitives/spinner';
export { ProgressBar } from './lib/primitives/progress-bar';
export type { ProgressBarProps } from './lib/primitives/progress-bar';
export { CopyButton } from './lib/primitives/copy-button';
export type { CopyButtonProps } from './lib/primitives/copy-button';
export { FormField } from './lib/primitives/form-field';
export type { FormFieldProps } from './lib/primitives/form-field';
export { Separator } from './lib/primitives/separator';
export type { SeparatorProps } from './lib/primitives/separator';
export { ToggleSwitch } from './lib/primitives/toggle-switch';
export type { ToggleSwitchProps } from './lib/primitives/toggle-switch';
export { Avatar } from './lib/primitives/avatar';
export type { AvatarProps } from './lib/primitives/avatar';

// Composites
export { Select } from './lib/composites/select';
export type { SelectProps, SelectOption } from './lib/composites/select';
export { Dialog } from './lib/composites/dialog';
export type { DialogProps, DialogVariant } from './lib/composites/dialog';
export { Card } from './lib/composites/card';
export type { CardProps } from './lib/composites/card';
export { DataTable } from './lib/composites/data-table';
export type {
  DataTableProps,
  DataTableColumn,
} from './lib/composites/data-table';
export { Tabs } from './lib/composites/tabs';
export type { TabsProps, Tab } from './lib/composites/tabs';
export { Pagination } from './lib/composites/pagination';
export type { PaginationProps } from './lib/composites/pagination';
export { FilterPills } from './lib/composites/filter-pills';
export type {
  FilterPillsProps,
  FilterPill,
} from './lib/composites/filter-pills';
export { SliderField } from './lib/composites/slider-field';
export type { SliderFieldProps } from './lib/composites/slider-field';
export { Stepper } from './lib/composites/stepper';
export type { StepperProps, Step } from './lib/composites/stepper';
export { Collapsible } from './lib/composites/collapsible';
export type { CollapsibleProps } from './lib/composites/collapsible';
export { KeyValueRow } from './lib/composites/key-value-row';
export type { KeyValueRowProps } from './lib/composites/key-value-row';
export { SectionTitle } from './lib/composites/section-title';
export type { SectionTitleProps } from './lib/composites/section-title';
export {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from './lib/composites/dropdown';
export type {
  DropdownProps,
  DropdownItemProps,
} from './lib/composites/dropdown';
export { Sidebar } from './lib/composites/sidebar';
export type {
  SidebarProps,
  NavItem,
  NavGroup,
  SidebarUser,
} from './lib/composites/sidebar';

// Feedback
export { EmptyState } from './lib/feedback/empty-state';
export type { EmptyStateProps } from './lib/feedback/empty-state';
export { LoadingSkeleton } from './lib/feedback/loading-skeleton';
export type { LoadingSkeletonProps } from './lib/feedback/loading-skeleton';
export { Callout } from './lib/feedback/callout';
export type { CalloutProps, CalloutVariant } from './lib/feedback/callout';

// Layout
export { PageLayout } from './lib/layout/page-layout';
export type { PageLayoutProps } from './lib/layout/page-layout';
export { Navbar } from './lib/layout/navbar';
export type { NavbarProps } from './lib/layout/navbar';
export { DashboardHeader } from './lib/layout/dashboard-header';
export type { DashboardHeaderProps } from './lib/layout/dashboard-header';

// Theme
export { ThemeProvider } from './lib/theme/theme-provider';
export type { ThemeProviderProps } from './lib/theme/theme-provider';

// Domain — Market
export { StatCard } from './lib/domain/market/stat-card';
export type { StatCardProps } from './lib/domain/market/stat-card';
export { StatItem } from './lib/domain/market/stat-item';
export type { StatItemProps } from './lib/domain/market/stat-item';
export { PriceTicker } from './lib/domain/market/price-ticker';
export type {
  PriceTickerProps,
  TickerItem,
} from './lib/domain/market/price-ticker';
export { IndicatorInfoModal } from './lib/domain/market/indicator-info-modal';
export type { IndicatorKey } from './lib/domain/market/indicator-info-modal';

// Domain — Agent
export { DecisionFlowDiagram } from './lib/domain/agent/decision-flow-diagram';
export { ExplainPanel } from './lib/domain/agent/explain-panel';
export { ParameterCards } from './lib/domain/agent/parameter-cards';
export { StrategyPresets, PRESETS } from './lib/domain/agent/strategy-presets';
export { ModelInfoModal } from './lib/domain/agent/model-info-modal';
export type {
  ModelInfoModalProps,
  ModelInfoData,
} from './lib/domain/agent/model-info-modal';

// Domain — Chat
export type {
  AgentId,
  ChatCapability,
  ChatMessageItem,
  StreamError,
  AgentConfig,
  ChatSessionSummary,
  LLMOption,
} from './lib/domain/chat/types';
export { AgentHeader } from './lib/domain/chat/agent-header';
export { AgentSelector, AGENTS } from './lib/domain/chat/agent-selector';
export { CapabilityButtons } from './lib/domain/chat/capability-buttons';
export { ChatInput } from './lib/domain/chat/chat-input';
export { OrchestratingIndicator } from './lib/domain/chat/orchestrating-indicator';
export { ToolCallCard } from './lib/domain/chat/tool-call-card';

// Domain — Help
export { HelpSidebar } from './lib/domain/help/help-sidebar';

// Charts
export { ChartCard } from './lib/charts/chart-card';
export type { ChartCardProps } from './lib/charts/chart-card';
export { ChartTooltip } from './lib/charts/chart-tooltip';
export type { ChartTooltipProps } from './lib/charts/chart-tooltip';
export {
  CHART_COLORS,
  CHART_PALETTE,
  RECHARTS_DEFAULTS,
  LIGHTWEIGHT_CHART_DEFAULTS,
  CANDLESTICK_COLORS,
} from './lib/charts/chart-theme';
export type { ChartColor } from './lib/charts/chart-theme';
