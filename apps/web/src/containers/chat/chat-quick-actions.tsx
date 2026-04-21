import { ArrowRight, BookOpen, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QuickAction } from '../../hooks/use-chat';

interface ChatQuickActionsProps {
  actions: QuickAction[];
  onTransferAgent?: (target: string) => void;
}

const ICON_MAP = {
  navigate: ArrowRight,
  open_docs: BookOpen,
  transfer_agent: Users,
};

export function ChatQuickActions({
  actions,
  onTransferAgent,
}: ChatQuickActionsProps) {
  const navigate = useNavigate();

  const handleClick = (action: QuickAction) => {
    switch (action.type) {
      case 'navigate':
        navigate(action.target);
        break;
      case 'open_docs':
        // Could open a docs modal or navigate to help
        navigate(`/dashboard/help?doc=${action.target}`);
        break;
      case 'transfer_agent':
        onTransferAgent?.(action.target);
        break;
    }
  };

  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-10">
      {actions.map((action, i) => {
        const Icon = ICON_MAP[action.type] ?? ArrowRight;
        return (
          <button
            key={i}
            onClick={() => handleClick(action)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/50"
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
