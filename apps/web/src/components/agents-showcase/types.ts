export interface AgentShowcase {
  id: string;
  codename: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  glowColor: string;
  ringColor: string;
  quote: string;
  description: string;
  capabilities: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[];
  tags: string[];
}
