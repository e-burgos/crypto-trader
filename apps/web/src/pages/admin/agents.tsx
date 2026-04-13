import { useState, useRef, useCallback } from 'react';
import {
  Bot,
  Cpu,
  TrendingUp,
  Link,
  Shield,
  Sparkles,
  FileText,
  Trash2,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useAgents,
  useAgent,
  useUpdateAgent,
  useUploadDocument,
  useDeleteDocument,
  type AgentDefinition,
  type AgentDocument,
} from '../../hooks/use-admin-agents';
import type { AgentId } from '../../hooks/use-chat-agent';
import { AGENTS } from '../../components/chat/agent-selector';

gsap.registerPlugin(useGSAP);

const AGENT_ICON_MAP: Record<
  AgentId,
  React.ComponentType<{ className?: string }>
> = {
  platform: Cpu,
  operations: Bot,
  market: TrendingUp,
  blockchain: Link,
  risk: Shield,
  orchestrator: Sparkles,
};

const AGENT_COLOR_MAP: Record<AgentId, { text: string; bg: string }> = {
  platform: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  operations: { text: 'text-orange-400', bg: 'bg-orange-500/10' },
  market: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  blockchain: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  risk: { text: 'text-red-400', bg: 'bg-red-500/10' },
  orchestrator: { text: 'text-primary', bg: 'bg-primary/10' },
};

const AGENT_NAMES: Record<AgentId, string> = {
  platform: 'NEXUS',
  operations: 'FORGE',
  market: 'SIGMA',
  blockchain: 'CIPHER',
  risk: 'AEGIS',
  orchestrator: 'KRYPTO',
};

const STATUS_CONFIG = {
  PENDING: {
    icon: Clock,
    label: 'Pending',
    className: 'text-muted-foreground',
  },
  PROCESSING: {
    icon: Loader2,
    label: 'Processing',
    className: 'text-orange-400 animate-spin',
  },
  READY: { icon: CheckCircle, label: 'Ready', className: 'text-emerald-400' },
  ERROR: { icon: XCircle, label: 'Error', className: 'text-red-400' },
};

function DocumentRow({
  doc,
  onDelete,
  isDeleting,
}: {
  doc: AgentDocument;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const status = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/20 px-3 py-2 ring-1 ring-border/50">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {(doc.sizeBytes / 1024).toFixed(1)} KB
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusIcon className={cn('h-4 w-4', status.className)} />
        <span className="text-xs text-muted-foreground">{status.label}</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AgentCard({ agentId }: { agentId: AgentId }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const { data: agent, isLoading } = useAgent(expanded ? agentId : null);
  const { mutate: updateAgent, isPending: isUpdating } = useUpdateAgent();
  const { mutate: uploadDoc, isPending: isUploading } = useUploadDocument();
  const { mutate: deleteDoc, isPending: isDeleting } = useDeleteDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const Icon = AGENT_ICON_MAP[agentId] ?? Sparkles;
  const color = AGENT_COLOR_MAP[agentId];
  const name = AGENT_NAMES[agentId];

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      uploadDoc({ agentId, file });
      e.target.value = '';
    },
    [agentId, uploadDoc],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      uploadDoc({ agentId, file });
    },
    [agentId, uploadDoc],
  );

  const handleSavePrompt = () => {
    updateAgent({ id: agentId, dto: { systemPrompt: promptDraft } });
    setEditingPrompt(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-border',
            color.bg,
          )}
        >
          <Icon className={cn('h-5 w-5', color.text)} />
        </div>
        <div className="flex-1 text-left">
          <p className={cn('font-bold', color.text)}>{name}</p>
          <p className="text-xs text-muted-foreground">
            {t(`agents.${agentId}Desc`)}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-5">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : agent ? (
            <>
              {/* System Prompt Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {t('agents.systemPrompt')}
                  </p>
                  {!editingPrompt ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft(agent.systemPrompt);
                        setEditingPrompt(true);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSavePrompt}
                        disabled={isUpdating}
                        className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                      >
                        {isUpdating ? t('common.saving') : t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPrompt(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  )}
                </div>
                {editingPrompt ? (
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    className="w-full h-48 resize-y rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                ) : (
                  <pre className="max-h-32 overflow-auto rounded-lg bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                    {agent.systemPrompt.slice(0, 300)}
                    {agent.systemPrompt.length > 300 ? '…' : ''}
                  </pre>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {t('agents.knowledgeBase')}
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-5 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('agents.dropZone')}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Document list */}
                {agent.documents && agent.documents.length > 0 ? (
                  <div className="space-y-2">
                    {agent.documents.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onDelete={() =>
                          deleteDoc({ agentId, docId: doc.id })
                        }
                        isDeleting={isDeleting}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    {t('agents.noDocuments')}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AdminAgentsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: agents = [], isLoading } = useAgents();

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.agent-card',
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.06,
          duration: 0.3,
          ease: 'power2.out',
        },
      );
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  const agentIds: AgentId[] = [
    'orchestrator',
    'platform',
    'operations',
    'market',
    'blockchain',
    'risk',
  ];

  return (
    <div ref={containerRef}>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {t('agents.pageDesc')}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {agentIds.map((id) => (
            <div
              key={id}
              className="h-16 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {agentIds.map((id) => (
            <div key={id} className="agent-card">
              <AgentCard agentId={id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
