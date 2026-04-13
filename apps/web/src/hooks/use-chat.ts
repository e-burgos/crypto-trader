import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';
import type { AgentId, RoutingEvent, OrchestratingEvent } from './use-chat-agent';

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
  provider: string;
  model: string;
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
  metadata?: { capability?: string } | null;
}

export interface ChatSessionWithMessages extends ChatSessionSummary {
  messages: ChatMessageItem[];
}

export interface CreateSessionDto {
  provider: string;
  model: string;
  title?: string;
  agentId?: string | null;
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
  });
}

export function useCreateChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSessionDto) =>
      api.post<ChatSessionSummary>('/chat/sessions', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
    onError: () => {
      toast.error(
        'Failed to create chat session. Check your API key in Settings.',
      );
    },
  });
}

export function useDeleteChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/chat/sessions/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
    onError: () => {
      toast.error('Failed to delete session.');
    },
  });
}

export function useSaveUserMessage(sessionId: string) {
  return useMutation({
    mutationFn: (dto: SendMessageDto) =>
      api.post<{ userMessageId: string }>(
        `/chat/sessions/${sessionId}/messages`,
        dto,
      ),
  });
}

// ── SSE Streaming Hook ─────────────────────────────────────────────────────

export function useChatStream(
  sessionId: string | null,
  options?: {
    onRouting?: (event: RoutingEvent) => void;
    onOrchestrating?: (event: OrchestratingEvent) => void;
    onDone?: () => void;
  },
) {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  const startStream = useCallback(
    (content: string, capability?: ChatCapability) => {
      if (!sessionId || !accessToken) return;

      // Close any existing stream
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setStreamingContent('');
      setIsStreaming(true);
      setError(null);

      const params = new URLSearchParams({
        content,
        token: accessToken,
        ...(capability ? { capability } : {}),
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
          };

          if (data.error) {
            setError(data.error);
            setIsStreaming(false);
            es.close();
            esRef.current = null;
            return;
          }

          // New SSE event types (Spec 28 Fase C)
          if (data.type === 'routing' && data.agentId) {
            options?.onRouting?.({ agentId: data.agentId, greeting: data.greeting });
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
        setError('Connection error. Please try again.');
        setIsStreaming(false);
        es.close();
        esRef.current = null;
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

  return { streamingContent, isStreaming, error, startStream, stopStream };
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
