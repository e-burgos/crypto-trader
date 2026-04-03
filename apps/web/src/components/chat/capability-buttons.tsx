import { useRef } from 'react';
import { HelpCircle, TrendingUp, BarChart2, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatCapability } from '../../hooks/use-chat';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface Capability {
  key: ChatCapability;
  icon: React.FC<{ className?: string }>;
  color: string;
  glow: string;
}

const CAPABILITIES: Capability[] = [
  {
    key: 'help',
    icon: HelpCircle,
    color:
      'text-sky-400 bg-sky-500/8 border-sky-500/25 hover:bg-sky-500/15 hover:border-sky-400/50',
    glow: 'hover:shadow-[0_0_18px_hsl(199_89%_48%/0.2)]',
  },
  {
    key: 'trade',
    icon: TrendingUp,
    color:
      'text-emerald-400 bg-emerald-500/8 border-emerald-500/25 hover:bg-emerald-500/15 hover:border-emerald-400/50',
    glow: 'hover:shadow-[0_0_18px_hsl(160_84%_39%/0.2)]',
  },
  {
    key: 'market',
    icon: BarChart2,
    color:
      'text-amber-400 bg-amber-500/8 border-amber-500/25 hover:bg-amber-500/15 hover:border-amber-400/50',
    glow: 'hover:shadow-[0_0_18px_hsl(43_96%_56%/0.2)]',
  },
  {
    key: 'blockchain',
    icon: BookOpen,
    color:
      'text-violet-400 bg-violet-500/8 border-violet-500/25 hover:bg-violet-500/15 hover:border-violet-400/50',
    glow: 'hover:shadow-[0_0_18px_hsl(263_70%_50%/0.2)]',
  },
];

interface CapabilityButtonsProps {
  onSelect: (content: string, capability: ChatCapability) => void;
  compact?: boolean;
}

export function CapabilityButtons({
  onSelect,
  compact = false,
}: CapabilityButtonsProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const getLabel = (key: ChatCapability) =>
    t(`chat.capabilities.${key}`, {
      defaultValue: {
        help: 'Platform Help',
        trade: 'Create a Trade',
        market: 'Market Analysis',
        blockchain: 'Learn Blockchain',
      }[key],
    });

  const getMessage = (key: ChatCapability) =>
    t(`chat.capabilityMessages.${key}`, {
      defaultValue: {
        help: 'Give me an overview of all platform features and how to use them.',
        trade: 'Help me create a new trade step by step.',
        market:
          'Analyze the current market and give me a BUY, SELL, or HOLD recommendation.',
        blockchain:
          'Explain the core blockchain and DeFi concepts I need to know.',
      }[key],
    });

  useGSAP(
    () => {
      gsap.fromTo(
        '.cap-btn',
        { opacity: 0, y: 16, scale: 0.93 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.35,
          ease: 'power2.out',
          stagger: 0.06,
          clearProps: 'all',
        },
      );
    },
    { scope: containerRef },
  );

  if (compact) {
    return (
      <div ref={containerRef} className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
        {CAPABILITIES.map(({ key, icon: Icon, color, glow }) => (
          <button
            key={key}
            onClick={() => onSelect(getMessage(key), key)}
            className={cn(
              'cap-btn flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium',
              'transition-all duration-200',
              color,
              glow,
            )}
          >
            <Icon className="h-3 w-3" />
            {getLabel(key)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-2.5 px-3 py-3">
      {CAPABILITIES.map(({ key, icon: Icon, color, glow }) => (
        <button
          key={key}
          onClick={() => onSelect(getMessage(key), key)}
          className={cn(
            'cap-btn flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left',
            'transition-all duration-200 active:scale-95',
            color,
            glow,
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-current/10">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold leading-tight">
            {getLabel(key)}
          </span>
        </button>
      ))}
    </div>
  );
}
