import { create } from 'zustand';

const STORAGE_KEY = 'chat:activeSessionId';

interface ChatStore {
  isOpen: boolean;
  activeSessionId: string | null;
  /** Per-message provider override (null = use session default) */
  sessionProvider: string | null;
  /** Per-message model override (null = use session default) */
  sessionModel: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveSession: (id: string | null) => void;
  setSessionLLM: (provider: string | null, model: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeSessionId: localStorage.getItem(STORAGE_KEY) ?? null,
  sessionProvider: null,
  sessionModel: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveSession: (id) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ activeSessionId: id, sessionProvider: null, sessionModel: null });
  },
  setSessionLLM: (provider, model) =>
    set({ sessionProvider: provider, sessionModel: model }),
}));
