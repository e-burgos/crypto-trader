import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { AgentId } from './use-chat-agent';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentDefinition {
  id: AgentId;
  displayName: string;
  description: string;
  systemPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documents?: AgentDocument[];
}

export interface AgentDocument {
  id: string;
  agentId: AgentId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  errorMsg?: string | null;
  processedAt?: string | null;
  uploadedAt: string;
}

export interface UpdateAgentDto {
  systemPrompt?: string;
  isActive?: boolean;
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const agentKeys = {
  all: ['admin', 'agents'] as const,
  detail: (id: AgentId) => ['admin', 'agents', id] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useAgents() {
  return useQuery<AgentDefinition[]>({
    queryKey: agentKeys.all,
    queryFn: () => api.get('/admin/agents'),
    staleTime: 30_000,
  });
}

export function useAgent(id: AgentId | null) {
  return useQuery<AgentDefinition>({
    queryKey: agentKeys.detail(id as AgentId),
    queryFn: () => api.get(`/admin/agents/${id}`),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: AgentId; dto: UpdateAgentDto }) =>
      api.patch<AgentDefinition>(`/admin/agents/${id}`, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
      toast.success('Agent updated');
    },
    onError: () => {
      toast.error('Failed to update agent');
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, file }: { agentId: AgentId; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.postForm<AgentDocument>(
        `/admin/agents/${agentId}/documents`,
        form,
      );
    },
    onSuccess: (_, { agentId }) => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast.success('Document uploaded, processing started');
    },
    onError: () => {
      toast.error('Failed to upload document');
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, docId }: { agentId: AgentId; docId: string }) =>
      api.delete(`/admin/agents/${agentId}/documents/${docId}`),
    onSuccess: (_, { agentId }) => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast.success('Document deleted');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });
}
