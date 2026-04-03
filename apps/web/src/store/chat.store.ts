import { create } from 'zustand';

interface ChatStore {
  isOpen: boolean;
  activeSessionId: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveSession: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeSessionId: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveSession: (id) => set({ activeSessionId: id }),
}));
