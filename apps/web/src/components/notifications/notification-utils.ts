import type { TFunction } from 'i18next';

export function getNotificationRoute(type: string, message: string): string {
  try {
    const parsed = JSON.parse(message) as { key?: string };
    const key = parsed?.key ?? '';

    if (key === 'tradeBuy' || key === 'tradeSell' || key === 'manualClose') {
      return '/dashboard/history';
    }
    if (key === 'stopLoss' || key === 'takeProfit') {
      return '/dashboard/positions';
    }
    if (
      key === 'agentError' ||
      key === 'agentNoLLM' ||
      key === 'agentNoTestnetKeys' ||
      key === 'agentNetworkError' ||
      key === 'agentRateLimit' ||
      key === 'agentLlmError' ||
      key === 'orderError'
    ) {
      return '/dashboard/config';
    }
  } catch {
    // not JSON
  }

  switch (type) {
    case 'TRADE_EXECUTED':
      return '/dashboard/history';
    case 'STOP_LOSS_TRIGGERED':
    case 'TAKE_PROFIT_HIT':
      return '/dashboard/positions';
    case 'AGENT_ERROR':
      return '/dashboard/config';
    default:
      return '/dashboard';
  }
}

export function iconBg(type: string, message: string): string {
  let key = '';
  try {
    key = (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    /* empty */
  }
  if (key === 'tradeBuy') return 'bg-emerald-500/10';
  if (key === 'tradeSell' || key === 'manualClose') return 'bg-blue-500/10';
  if (key === 'stopLoss' || key === 'orderError' || key === 'agentError')
    return 'bg-red-500/10';
  if (key === 'takeProfit') return 'bg-amber-500/10';
  if (
    key === 'agentNoLLM' ||
    key === 'agentNoTestnetKeys' ||
    key === 'agentNetworkError' ||
    key === 'agentRateLimit' ||
    key === 'agentLlmError'
  )
    return 'bg-amber-500/10';
  switch (type) {
    case 'STOP_LOSS_TRIGGERED':
    case 'AGENT_ERROR':
      return 'bg-red-500/10';
    case 'TAKE_PROFIT_HIT':
      return 'bg-amber-500/10';
    default:
      return 'bg-muted';
  }
}

export function translateMessage(raw: string, t: TFunction): string {
  try {
    const parsed = JSON.parse(raw) as { key?: string; [k: string]: unknown };
    if (parsed?.key) {
      return t(
        `notificationMessages.${parsed.key}`,
        parsed as Record<string, string>,
      ) as string;
    }
  } catch {
    /* empty */
  }
  return raw;
}

export function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function routeLabel(route: string, t: TFunction): string {
  const map: Record<string, string> = {
    '/dashboard/history': t('sidebar.tradeHistory'),
    '/dashboard/positions': t('sidebar.positions'),
    '/dashboard/config': t('sidebar.config'),
    '/dashboard': t('sidebar.overview'),
  };
  return map[route] ?? route;
}

export function getMessageKey(message: string): string {
  try {
    return (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    return '';
  }
}
