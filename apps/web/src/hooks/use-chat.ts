import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useChatStore } from '../store/chat.store';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  AgentId,
  RoutingEvent,
  OrchestratingEvent,
} from './use-chat-agent';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type ChatCapability = 'help' | 'trade' | 'market' | 'blockchain';

export interface LLMOption {
  provider: string;
  label: string;
  model: string;
  models: string[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  provider: string | null;
  model: string | null;
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface ChatMessageItem {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  generatedBy?: string | null;
  metadata?: { capability?: string } | null;
}

export interface ChatSessionWithMessages extends ChatSessionSummary {
  messages: ChatMessageItem[];
}

export interface CreateSessionDto {
  title?: string;
  agentId?: string | null;
  provider?: string;
  model?: string;
}

export interface SendMessageDto {
  content: string;
  capability?: ChatCapability;
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const chatKeys = {
  llmOptions: ['chat', 'llm-options'] as const,
  sessions: ['chat', 'sessions'] as const,
  session: (id: string) => ['chat', 'sessions', id] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useChatLLMOptions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<LLMOption[]>({
    queryKey: chatKeys.llmOptions,
    queryFn: () => api.get('/chat/llm-options'),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useChatSessions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ChatSessionSummary[]>({
    queryKey: chatKeys.sessions,
    queryFn: () => api.get('/chat/sessions'),
    staleTime: 30_000,
    enabled: isAuthenticated,
  });
}

export function useChatSession(sessionId: string | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ChatSessionWithMessages>({
    queryKey: chatKeys.session(sessionId ?? ''),
    queryFn: () => api.get(`/chat/sessions/${sessionId}`),
    staleTime: 0,
    enabled: isAuthenticated && !!sessionId,
    retry: (failureCount, error) => {
      // Don't retry on 404 — session was deleted or stale localStorage ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (
        err?.statusCode === 404 ||
        err?.status === 404 ||
        err?.response?.status === 404
      ) {
        // Clear stale session from store + localStorage
        useChatStore.getState().setActiveSession(null);
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useCreateChatSession() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (dto: CreateSessionDto) =>
      api.post<ChatSessionSummary>('/chat/sessions', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
    onError: () => {
      toast.error(
        t('chat.errors.CREATE_SESSION_ERROR', {
          defaultValue:
            'Failed to create session. Check your API key in Settings.',
        }),
      );
    },
  });
}

export function useDeleteChatSession() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/chat/sessions/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
    onError: () => {
      toast.error(
        t('chat.errors.DELETE_SESSION_ERROR', {
          defaultValue: 'Failed to delete session.',
        }),
      );
    },
  });
}

export function useUpdateChatSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { provider?: string; model?: string }) =>
      api.patch(`/chat/sessions/${sessionId}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
      qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
  });
}

export function useSaveUserMessage(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SendMessageDto) =>
      api.post<{ userMessageId: string }>(
        `/chat/sessions/${sessionId}/messages`,
        dto,
      ),
    onMutate: async (dto) => {
      // Cancel outgoing refetches so they don't overwrite the optimistic update
      await qc.cancelQueries({ queryKey: chatKeys.session(sessionId) });

      const previous = qc.getQueryData<ChatSessionWithMessages>(
        chatKeys.session(sessionId),
      );

      if (previous) {
        const optimisticMsg: ChatMessageItem = {
          id: `optimistic-${Date.now()}`,
          role: 'USER',
          content: dto.content,
          createdAt: new Date().toISOString(),
          metadata: dto.capability ? { capability: dto.capability } : null,
        };
        qc.setQueryData<ChatSessionWithMessages>(chatKeys.session(sessionId), {
          ...previous,
          messages: [...previous.messages, optimisticMsg],
        });
      }

      return { previous };
    },
    onError: (_err, _dto, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(chatKeys.session(sessionId), context.previous);
      }
    },
  });
}

// ── Types for stream errors ────────────────────────────────────────────────
export type LLMErrorCode =
  | 'RATE_LIMIT'
  | 'CREDIT_LIMIT'
  | 'INVALID_API_KEY'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_ERROR'
  | 'CONNECTION_ERROR';

export interface StreamError {
  errorCode: LLMErrorCode;
  message: string;
  retryAfter?: number;
}

// ── Types for interactive elements (Phase D) ──────────────────────────────
export interface QuickAction {
  type: 'navigate' | 'open_docs' | 'transfer_agent';
  label: string;
  target: string;
}

export interface InlineOption {
  id: string;
  label: string;
  value: string;
}

// ── SSE Streaming Hook ─────────────────────────────────────────────────────

export function useChatStream(
  sessionId: string | null,
  options?: {
    onRouting?: (event: RoutingEvent) => void;
    onOrchestrating?: (event: OrchestratingEvent) => void;
    onDone?: () => void;
    onError?: (msg: string) => void;
  },
) {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<StreamError | null>(null);
  const [quickActions, setQuickActions] = useState<QuickAction[] | null>(null);
  const [inlineOptions, setInlineOptions] = useState<InlineOption[] | null>(
    null,
  );
  const esRef = useRef<EventSource | null>(null);
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { t, i18n } = useTranslation();

  // Reset all streaming state when session changes (prevents stale content in new sessions)
  useEffect(() => {
    setStreamingContent('');
    setIsStreaming(false);
    setError(null);
    setStreamError(null);
    setQuickActions(null);
    setInlineOptions(null);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [sessionId]);

  const startStream = useCallback(
    (content: string, capability?: ChatCapability, agentId?: string) => {
      if (!sessionId || !accessToken) return;

      // Close any existing stream
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setStreamingContent('');
      setIsStreaming(true);
      setError(null);
      setStreamError(null);
      setQuickActions(null);
      setInlineOptions(null);

      const params = new URLSearchParams({
        content,
        token: accessToken,
        ...(capability ? { capability } : {}),
        locale: i18n.language || 'en',
        ...(agentId ? { agentId } : {}),
      });

      const url = `${API_BASE}/chat/sessions/${sessionId}/stream?${params.toString()}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as {
            type?: string;
            agentId?: AgentId;
            greeting?: string;
            subAgents?: AgentId[];
            step?: string;
            delta?: string;
            done?: boolean;
            messageId?: string;
            fullContent?: string;
            error?: string;
            errorCode?: string;
            retryAfter?: number;
            quickActions?: QuickAction[];
            inlineOptions?: InlineOption[];
          };

          if (data.error) {
            const code =
              (data.errorCode as LLMErrorCode | undefined) ?? 'PROVIDER_ERROR';
            const retryAfter = data.retryAfter;

            // Build translated message
            let translatedMsg: string;
            if (code === 'RATE_LIMIT') {
              translatedMsg = retryAfter
                ? t('chat.errors.RATE_LIMIT', {
                    retryAfter,
                    defaultValue: `AI provider rate limit reached. Try again in ${retryAfter} min.`,
                  })
                : t('chat.errors.RATE_LIMIT_no_retry', {
                    defaultValue:
                      'AI provider rate limit reached. Please try again in a few minutes.',
                  });
            } else {
              translatedMsg = t(`chat.errors.${code}`, {
                defaultValue: data.error,
              });
            }

            setError(translatedMsg);
            setStreamError({
              errorCode: code,
              message: translatedMsg,
              retryAfter,
            });
            setIsStreaming(false);
            es.close();
            esRef.current = null;
            options?.onDone?.();
            options?.onError?.(translatedMsg);
            toast.error(translatedMsg, { duration: 8000 });
            qc.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
            return;
          }

          // New SSE event types (Spec 28 Fase C)
          if (data.type === 'routing' && data.agentId) {
            options?.onRouting?.({
              agentId: data.agentId,
              greeting: data.greeting,
            });
            return;
          }

          if (data.type === 'orchestrating') {
            options?.onOrchestrating?.({
              subAgents: data.subAgents ?? [],
              step: data.step ?? '',
            });
            return;
          }

          if (data.delta) {
            setStreamingContent((prev) => prev + data.delta);
          }

          if (data.done) {
            setIsStreaming(false);
            if (data.quickActions?.length) setQuickActions(data.quickActions);
            if (data.inlineOptions?.length)
              setInlineOptions(data.inlineOptions);
            es.close();
            esRef.current = null;
            options?.onDone?.();
            // Refresh session data to persist the new assistant message
            qc.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
            qc.invalidateQueries({ queryKey: chatKeys.sessions });
          }
        } catch {
          // ignore JSON parse errors on partial chunks
        }
      };

      es.onerror = () => {
        const code: LLMErrorCode = 'CONNECTION_ERROR';
        const msg = t('chat.errors.CONNECTION_ERROR', {
          defaultValue:
            'Connection to the server was lost. Check your connection and try again.',
        });
        setError(msg);
        setStreamError({ errorCode: code, message: msg });
        setIsStreaming(false);
        es.close();
        esRef.current = null;
        options?.onDone?.();
        options?.onError?.(msg);
        toast.error(msg, { duration: 8000 });
      };
    },
    [sessionId, accessToken, qc, options],
  );

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsStreaming(false);
    if (streamingContent) {
      // Re-fetch session to get partial message that was persisted
      if (sessionId) {
        qc.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
      }
    }
  }, [streamingContent, sessionId, qc]);

  return {
    streamingContent,
    isStreaming,
    error,
    streamError,
    quickActions,
    inlineOptions,
    startStream,
    stopStream,
  };
}

// ── Tool Execution ─────────────────────────────────────────────────────────

export interface ExecuteToolDto {
  tool: string;
  params?: Record<string, unknown>;
  confirmation?: string;
}

export function useExecuteTool(sessionId: string | null) {
  return useMutation({
    mutationFn: (dto: ExecuteToolDto) =>
      api.post<{ tool: string; result: unknown }>(
        `/chat/sessions/${sessionId}/tools/execute`,
        dto,
      ),
    onError: () => {
      toast.error('Tool execution failed');
    },
  });
}

// ── D: Inline option selection ─────────────────────────────────────────────

export function useSelectOption(sessionId: string | null) {
  return useMutation({
    mutationFn: (body: { optionId: string; value: string }) =>
      api.post<{ action: string; target?: string }>(
        `/chat/sessions/${sessionId}/select`,
        body,
      ),
  });
}
