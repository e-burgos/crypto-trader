import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  BotMessageSquare,
  XCircle,
} from 'lucide-react';

export function NotifIcon({
  type,
  message,
}: {
  type: string;
  message: string;
}) {
  let key = '';
  try {
    key = (JSON.parse(message) as { key?: string })?.key ?? '';
  } catch {
    /* empty */
  }

  if (key === 'tradeBuy') {
    return <TrendingUp className="h-5 w-5 text-emerald-500" />;
  }
  if (key === 'tradeSell' || key === 'manualClose') {
    return <TrendingDown className="h-5 w-5 text-blue-400" />;
  }
  if (key === 'stopLoss') {
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  }
  if (key === 'takeProfit') {
    return <TrendingUp className="h-5 w-5 text-amber-400" />;
  }
  if (key === 'orderError' || key === 'agentError') {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (
    key === 'agentNoLLM' ||
    key === 'agentNoTestnetKeys' ||
    key === 'agentNetworkError' ||
    key === 'agentRateLimit' ||
    key === 'agentLlmError'
  ) {
    return <ShieldAlert className="h-5 w-5 text-amber-500" />;
  }

  switch (type) {
    case 'TRADE_EXECUTED':
      return <TrendingUp className="h-5 w-5 text-emerald-500" />;
    case 'STOP_LOSS_TRIGGERED':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'TAKE_PROFIT_HIT':
      return <TrendingUp className="h-5 w-5 text-amber-400" />;
    case 'AGENT_ERROR':
      return <BotMessageSquare className="h-5 w-5 text-red-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}
