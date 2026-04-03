import { create } from 'zustand';

const COLLAPSED_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: readCollapsed(),
  mobileOpen: false,

  toggleCollapsed: () =>
    set((s) => {
      const next = !s.collapsed;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        /* noop */
      }
      return { collapsed: next };
    }),

  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
}));
