export type NotifTab = 'all' | 'unread' | 'trades' | 'agent';

export const NOTIF_TABS: { id: NotifTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'notifications.tabAll' },
  { id: 'unread', labelKey: 'notifications.tabUnread' },
  { id: 'trades', labelKey: 'notifications.tabTrades' },
  { id: 'agent', labelKey: 'notifications.tabAgent' },
];

export const TRADE_KEYS = new Set([
  'tradeBuy',
  'tradeSell',
  'manualClose',
  'stopLoss',
  'takeProfit',
]);
export const AGENT_KEYS = new Set([
  'agentError',
  'agentNoLLM',
  'agentNoTestnetKeys',
  'agentNetworkError',
  'agentRateLimit',
  'agentLlmError',
  'orderError',
]);

export const PAGE_SIZE = 10;
