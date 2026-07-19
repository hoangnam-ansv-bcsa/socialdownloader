import { create } from 'zustand';
import { MediaItem, AppSettings, LogEntry, DashboardStats, PlatformType } from '../types';

interface AppStoreState {
  activeTab: 'dashboard' | 'queue' | 'downloader' | 'media' | 'history' | 'logs' | 'settings' | 'about';
  settings: AppSettings | null;
  logs: LogEntry[];
  history: MediaItem[];
  queue: MediaItem[];
  stats: DashboardStats | null;
  analyzedItems: MediaItem[];
  isAnalyzing: boolean;
  urlInput: string;
  searchQuery: string;
  selectedPlatformFilter: PlatformType | 'All';
  selectedTypeFilter: 'All' | 'video' | 'photo' | 'album' | 'audio';

  setTab: (tab: AppStoreState['activeTab']) => void;
  setUrlInput: (val: string) => void;
  setSearchQuery: (val: string) => void;
  setPlatformFilter: (val: PlatformType | 'All') => void;
  setTypeFilter: (val: AppStoreState['selectedTypeFilter']) => void;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  fetchLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  addToQueue: (items: MediaItem[]) => Promise<void>;
  queueAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'delete' | 'restart') => Promise<void>;
  clearCompletedQueue: () => Promise<void>;
  fetchStats: () => Promise<void>;
  analyzeUrls: (urls: string[]) => Promise<void>;
  toggleAnalyzedSelection: (id: string) => void;
  toggleAllAnalyzedSelection: (checked: boolean) => void;
  clearAnalyzedItems: () => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  activeTab: 'dashboard',
  settings: null,
  logs: [],
  history: [],
  queue: [],
  stats: null,
  analyzedItems: [],
  isAnalyzing: false,
  urlInput: '',
  searchQuery: '',
  selectedPlatformFilter: 'All',
  selectedTypeFilter: 'All',

  setTab: (tab) => set({ activeTab: tab }),
  setUrlInput: (val) => set({ urlInput: val }),
  setSearchQuery: (val) => set({ searchQuery: val }),
  setPlatformFilter: (val) => set({ selectedPlatformFilter: val }),
  setTypeFilter: (val) => set({ selectedTypeFilter: val }),

  fetchSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      set({ settings });
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  },

  updateSettings: async (settings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        set({ settings: data.settings });
        // Update document theme classes
        const root = document.documentElement;
        if (settings.theme === 'dark') {
          root.classList.add('dark');
        } else if (settings.theme === 'light') {
          root.classList.remove('dark');
        } else {
          // System theme
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (systemDark) root.classList.add('dark');
          else root.classList.remove('dark');
        }
      }
    } catch (err) {
      console.error('Failed to update settings', err);
    }
  },

  fetchLogs: async () => {
    try {
      const res = await fetch('/api/logs');
      const logs = await res.json();
      set({ logs });
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  },

  clearLogs: async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      set({ logs: [] });
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch('/api/history');
      const history = await res.json();
      set({ history });
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  },

  deleteHistoryItem: async (id) => {
    try {
      await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      get().fetchHistory();
      get().fetchStats();
    } catch (err) {
      console.error('Failed to delete history item', err);
    }
  },

  clearHistory: async () => {
    try {
      await fetch('/api/history/clear', { method: 'POST' });
      set({ history: [] });
      get().fetchStats();
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  },

  fetchQueue: async () => {
    try {
      const res = await fetch('/api/queue');
      const queue = await res.json();
      set({ queue });
    } catch (err) {
      console.error('Failed to fetch queue', err);
    }
  },

  addToQueue: async (items) => {
    try {
      await fetch('/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      get().fetchQueue();
      get().fetchStats();
    } catch (err) {
      console.error('Failed to add items to queue', err);
    }
  },

  queueAction: async (id, action) => {
    try {
      await fetch('/api/queue/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      get().fetchQueue();
      get().fetchStats();
    } catch (err) {
      console.error('Failed to trigger queue action', err);
    }
  },

  clearCompletedQueue: async () => {
    try {
      await fetch('/api/queue/clear-completed', { method: 'POST' });
      get().fetchQueue();
    } catch (err) {
      console.error('Failed to clear completed queue', err);
    }
  },

  fetchStats: async () => {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      set({ stats });
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  },

  analyzeUrls: async (urls) => {
    set({ isAnalyzing: true });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const analyzedItems = await res.json();
      set({ analyzedItems, isAnalyzing: false });
    } catch (err) {
      console.error('Failed to analyze URLs', err);
      set({ isAnalyzing: false });
    }
  },

  toggleAnalyzedSelection: (id) => {
    set((state) => ({
      analyzedItems: state.analyzedItems.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      ),
    }));
  },

  toggleAllAnalyzedSelection: (checked) => {
    set((state) => ({
      analyzedItems: state.analyzedItems.map((item) => ({
        ...item,
        selected: checked,
      })),
    }));
  },

  clearAnalyzedItems: () => set({ analyzedItems: [] }),
}));
