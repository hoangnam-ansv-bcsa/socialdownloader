import { create } from 'zustand';
import { MediaItem, AppSettings, LogEntry, DashboardStats, PlatformType } from '../types';

let channelScanPollTimer: ReturnType<typeof setTimeout> | null = null;

type ChannelScanStatus =
  | 'idle'
  | 'scanning'
  | 'completed'
  | 'stopped'
  | 'failed';

interface AppStoreState {
  activeTab: 'dashboard' | 'queue' | 'downloader' | 'media' | 'history' | 'logs' | 'settings' | 'about';
  settings: AppSettings | null;
  logs: LogEntry[];
  history: MediaItem[];
  queue: MediaItem[];
  stats: DashboardStats | null;
  analyzedItems: MediaItem[];
  isAnalyzing: boolean;
  channelScanSessionId: string | null;
  channelScanStatus: ChannelScanStatus;
  channelScanTotalLoaded: number;
  channelScanError: string | null;
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
  clearCompletedQueue: (
    ids?: string[],
  ) => Promise<void>;
  queueBulkAction: (
    action: 'pause' | 'resume' | 'cancel' | 'clear',
  ) => Promise<void>;
  fetchStats: () => Promise<void>;
  analyzeChannel: (url: string, limit?: number) => Promise<void>;
  stopChannelScan: () => Promise<void>;
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
  channelScanSessionId: null,
  channelScanStatus: 'idle',
  channelScanTotalLoaded: 0,
  channelScanError: null,
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

  clearCompletedQueue: async (ids) => {
    try {
      const response = await fetch(
        '/api/queue/clear-completed',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            Array.isArray(ids)
              ? { ids }
              : {},
          ),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Clear completed queue failed: ${response.status}`,
        );
      }

      const result = await response.json();

      set({
        queue: Array.isArray(result.queue)
          ? result.queue
          : [],
      });

      get().fetchStats();
    } catch (err) {
      console.error(
        'Failed to clear completed queue',
        err,
      );
    }
  },

  queueBulkAction: async (action) => {
    try {
      const response = await fetch(
        '/api/queue/bulk-action',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Queue bulk action failed: ${response.status}`,
        );
      }

      const result = await response.json();

      set({
        queue: Array.isArray(result.queue)
          ? result.queue
          : [],
      });

      get().fetchStats();
    } catch (err) {
      console.error(
        'Failed to trigger bulk queue action',
        err,
      );
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

  analyzeChannel: async (url) => {
    if (channelScanPollTimer) {
      clearTimeout(channelScanPollTimer);
      channelScanPollTimer = null;
    }

    set({
      isAnalyzing: true,
      analyzedItems: [],
      channelScanSessionId: null,
      channelScanStatus: 'scanning',
      channelScanTotalLoaded: 0,
      channelScanError: null,
    });

    try {
      const startResponse = await fetch(
        '/api/channel/scan/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        },
      );

      const startData: unknown =
        await startResponse.json();

      if (!startResponse.ok) {
        const message =
          typeof startData === 'object' &&
          startData !== null &&
          'error' in startData &&
          typeof startData.error === 'string'
            ? startData.error
            : 'Không thể bắt đầu quét kênh.';

        throw new Error(message);
      }

      if (
        typeof startData !== 'object' ||
        startData === null ||
        !('sessionId' in startData) ||
        typeof startData.sessionId !== 'string'
      ) {
        throw new Error(
          'Máy chủ không trả về mã phiên quét hợp lệ.',
        );
      }

      const sessionId = startData.sessionId;

      set({
        channelScanSessionId: sessionId,
      });

      const poll = async (): Promise<void> => {
        const currentState = get();

        if (
          currentState.channelScanSessionId !== sessionId
        ) {
          return;
        }

        try {
          const after =
            currentState.analyzedItems.length;

          const response = await fetch(
            `/api/channel/scan/${sessionId}?after=${after}`,
          );

          const data: unknown = await response.json();

          if (!response.ok) {
            const message =
              typeof data === 'object' &&
              data !== null &&
              'error' in data &&
              typeof data.error === 'string'
                ? data.error
                : 'Không đọc được tiến độ quét kênh.';

            throw new Error(message);
          }

          if (
            typeof data !== 'object' ||
            data === null
          ) {
            throw new Error(
              'Dữ liệu tiến độ quét không hợp lệ.',
            );
          }

          const items =
            'items' in data &&
            Array.isArray(data.items)
              ? data.items as MediaItem[]
              : [];

          const status =
            'status' in data &&
            typeof data.status === 'string'
              ? data.status as ChannelScanStatus
              : 'scanning';

          const totalLoaded =
            'totalLoaded' in data &&
            typeof data.totalLoaded === 'number'
              ? data.totalLoaded
              : after + items.length;

          set((state) => {
            const existingIds = new Set(
              state.analyzedItems.map(
                (item) => item.id,
              ),
            );

            const newItems = items
              .filter(
                (item) =>
                  !existingIds.has(item.id),
              )
              .map((item) => ({
                ...item,
                selected: true,
              }));

            return {
              analyzedItems: [
                ...state.analyzedItems,
                ...newItems,
              ],
              isAnalyzing:
                status === 'scanning' &&
                state.analyzedItems.length +
                  newItems.length ===
                  0,
              channelScanStatus: status,
              channelScanTotalLoaded: totalLoaded,
              channelScanError:
                'error' in data &&
                typeof data.error === 'string'
                  ? data.error
                  : null,
            };
          });

          if (status === 'scanning') {
            channelScanPollTimer = setTimeout(
              () => {
                void poll();
              },
              2000,
            );
          } else {
            channelScanPollTimer = null;

            set({
              isAnalyzing: false,
            });

            if (status === 'failed') {
              const message =
                'error' in data &&
                typeof data.error === 'string'
                  ? data.error
                  : 'Quét kênh bị lỗi.';

              alert(message);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Không đọc được tiến độ quét.';

          console.error(
            'Failed to poll channel scan:',
            message,
          );

          set({
            isAnalyzing: false,
            channelScanStatus: 'failed',
            channelScanError: message,
          });

          channelScanPollTimer = null;
          alert(message);
        }
      };

      void poll();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể bắt đầu quét kênh.';

      console.error(
        'Failed to start channel scan:',
        message,
      );

      set({
        isAnalyzing: false,
        channelScanStatus: 'failed',
        channelScanError: message,
      });

      alert(message);
    }
  },

  stopChannelScan: async () => {
    const sessionId =
      get().channelScanSessionId;

    if (!sessionId) {
      return;
    }

    try {
      await fetch(
        `/api/channel/scan/${sessionId}/stop`,
        {
          method: 'POST',
        },
      );
    } catch (error) {
      console.error(
        'Failed to stop channel scan:',
        error,
      );
    }

    if (channelScanPollTimer) {
      clearTimeout(channelScanPollTimer);
      channelScanPollTimer = null;
    }

    set({
      isAnalyzing: false,
      channelScanStatus: 'stopped',
    });
  },

  analyzeUrls: async (urls) => {
    set({
      isAnalyzing: true,
      analyzedItems: [],
    });

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const message =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Không thể phân tích liên kết.';

        throw new Error(message);
      }

      if (!Array.isArray(data)) {
        throw new Error(
          'Máy chủ trả về dữ liệu không đúng định dạng.',
        );
      }

      set({
        analyzedItems: data as MediaItem[],
        isAnalyzing: false,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể phân tích liên kết.';

      console.error(
        'Failed to analyze URLs:',
        message,
      );

      alert(message);

      set({
        analyzedItems: [],
        isAnalyzing: false,
      });
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

  clearAnalyzedItems: () => {
    if (channelScanPollTimer) {
      clearTimeout(channelScanPollTimer);
      channelScanPollTimer = null;
    }

    set({
      analyzedItems: [],
      isAnalyzing: false,
      channelScanSessionId: null,
      channelScanStatus: 'idle',
      channelScanTotalLoaded: 0,
      channelScanError: null,
    });
  },
}));
