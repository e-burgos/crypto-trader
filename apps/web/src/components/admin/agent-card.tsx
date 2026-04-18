import { useState, useRef, useCallback } from 'react';
import {
  Sparkles,
  Upload,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  useAgent,
  useUpdateAgent,
  useUploadDocument,
  useDeleteDocument,
} from '../../hooks/use-admin-agents';
import type { AgentId } from '@crypto-trader/ui';
import { DocumentRow } from './document-row';
import {
  AGENT_ICON_MAP,
  AGENT_COLOR_MAP,
  AGENT_NAMES,
} from './agent-constants';

export function AgentCard({ agentId }: { agentId: AgentId }) {
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
                <div key={i} className="h-3 animate-pulse rounded bg-muted" />
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
                        onDelete={() => deleteDoc({ agentId, docId: doc.id })}
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
