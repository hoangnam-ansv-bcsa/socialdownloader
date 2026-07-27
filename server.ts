import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

import {
  getSettings,
  saveSettings,
  getLogs,
  addLog,
  clearLogs,
  getHistory,
  addHistory,
  removeHistoryItem,
  clearHistory,
  getQueue,
  saveQueue,
  updateQueueItem,
  getDownloadDirectory,
} from './server_db';

import {
  getMediaMetadata,
  downloadMedia,
} from './backend/services/ytDlp';

import {
  analyzeUrl,
  analyzeChannel,
  analyzeChannelRange,
  isFacebookProfileRootUrl,
  type AnalyzeResult,
} from './backend/services/analyzeService';

import {
  MediaItem,
  DashboardStats,
  PlatformType,
} from './src/types';

import {
  getFacebookBrowserSession,
  setFacebookBrowserSession,
} from './backend/services/facebookSessionStore';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({
  limit: '1mb',
}));

const activeDownloads = new Map<string, AbortController>();

const downloadAbortActions =
  new Map<string, 'pause' | 'cancel'>();

const suppressedDownloadUpdates =
  new Set<string>();

let schedulerRunning = false;
let queuePaused = false;

type ChannelScanStatus =
  | 'scanning'
  | 'completed'
  | 'stopped'
  | 'failed';

interface ChannelScanSession {
  id: string;
  url: string;
  status: ChannelScanStatus;
  items: MediaItem[];
  error?: string;
  stopRequested: boolean;
  createdAt: number;
  updatedAt: number;
}

const CHANNEL_SCAN_BATCH_SIZE = 50;

const channelScanSessions =
  new Map<string, ChannelScanSession>();

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatDuration(
  totalSeconds?: number,
): string | undefined {
  if (
    totalSeconds === undefined ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return undefined;
  }

  const roundedSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor(
    (roundedSeconds % 3600) / 60,
  );
  const seconds = roundedSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) =>
        String(value).padStart(2, '0'),
      )
      .join(':');
  }

  return [minutes, seconds]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':');
}

function formatPublishDate(
  rawDate?: string,
): string {
  if (!rawDate || !/^\d{8}$/.test(rawDate)) {
    return new Date().toLocaleDateString('vi-VN');
  }

  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);

  return `${day}/${month}/${year}`;
}

function detectPlatform(
  extractor?: string,
  extractorKey?: string,
): PlatformType {
  const source =
    `${extractor || ''} ${extractorKey || ''}`
      .toLowerCase();

  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('douyin')) return 'Douyin';
  if (source.includes('xiaohongshu')) {
    return 'Xiaohongshu';
  }
  if (source.includes('kuaishou')) return 'Kuaishou';
  if (source.includes('bilibili')) return 'Bilibili';
  if (source.includes('pinterest')) return 'Pinterest';

  return 'YouTube';
}

function mapChannelResultToMediaItem(
  result: AnalyzeResult,
): MediaItem {
  return {
    id: result.id,
    url: result.url,
    platform: detectPlatform(
      result.platform,
      result.platform,
    ),
    title: result.title,
    author: result.author,
    thumbnail: result.thumbnail,
    mediaType: result.mediaType,
    publishDate:
      result.publishDate ||
      new Date().toLocaleDateString('vi-VN'),
    duration: result.duration,
    resolution:
      result.resolution ||
      'Tự động',
    estimatedSize: result.estimatedSize,
    status: 'ready',
    progress: 0,
    selected: true,
  };
}

async function runChannelScan(
  sessionId: string,
): Promise<void> {
  const session = channelScanSessions.get(
    sessionId,
  );

  if (!session) {
    return;
  }

  try {
    if (isFacebookProfileRootUrl(session.url)) {
      addLog(
        'info',
        'ChannelScanner',
        'Đang quét Facebook profile một lượt, không lặp lại theo batch.',
      );

      const results = await analyzeChannelRange(
        session.url,
        1,
        1000,
      );

      if (session.stopRequested) {
        session.status = 'stopped';
        session.updatedAt = Date.now();
        return;
      }

      const uniqueItems =
        new Map<string, MediaItem>();

      for (const result of results) {
        const item =
          mapChannelResultToMediaItem(result);

        const key =
          `${item.platform}:${item.mediaType}:${item.id || item.url}`;

        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        }
      }

      const allItems =
        Array.from(uniqueItems.values());

      for (
        let offset = 0;
        offset < allItems.length;
        offset += CHANNEL_SCAN_BATCH_SIZE
      ) {
        if (session.stopRequested) {
          session.status = 'stopped';
          session.updatedAt = Date.now();
          return;
        }

        const batch = allItems.slice(
          offset,
          offset + CHANNEL_SCAN_BATCH_SIZE,
        );

        session.items.push(...batch);
        session.updatedAt = Date.now();

        addLog(
          'info',
          'ChannelScanner',
          `Đã chuyển ${session.items.length}/${allItems.length} bài Facebook lên giao diện.`,
        );

        await sleep(500);
      }

      session.status = 'completed';
      session.updatedAt = Date.now();

      addLog(
        'info',
        'ChannelScanner',
        `Hoàn tất quét ${session.items.length} bài Facebook công khai trong một lượt.`,
      );

      return;
    }

    while (!session.stopRequested) {
      const start = session.items.length + 1;
      const end =
        start + CHANNEL_SCAN_BATCH_SIZE - 1;

      addLog(
        'info',
        'ChannelScanner',
        `Đang quét bài ${start}-${end}.`,
      );

      const results = await analyzeChannelRange(
        session.url,
        start,
        end,
      );

      if (session.stopRequested) {
        session.status = 'stopped';
        session.updatedAt = Date.now();
        return;
      }

      const existingIds = new Set(
        session.items.map((item) => item.id),
      );

      const newItems = results
        .map(mapChannelResultToMediaItem)
        .filter(
          (item) => !existingIds.has(item.id),
        );

      session.items.push(...newItems);
      session.updatedAt = Date.now();

      addLog(
        'info',
        'ChannelScanner',
        `Đã quét được ${session.items.length} bài.`,
      );

      if (
        results.length < CHANNEL_SCAN_BATCH_SIZE ||
        newItems.length === 0
      ) {
        session.status = 'completed';
        session.updatedAt = Date.now();

        addLog(
          'info',
          'ChannelScanner',
          `Hoàn tất quét ${session.items.length} bài công khai.`,
        );

        return;
      }
    }

    session.status = 'stopped';
    session.updatedAt = Date.now();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    session.status = 'failed';
    session.error = message;
    session.updatedAt = Date.now();

    addLog(
      'error',
      'ChannelScanner',
      message,
    );
  }
}

function sanitizeTemplateValue(
  value: string,
): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function buildFileName(
  item: MediaItem,
): string {
  const settings = getSettings();

  const values: Record<string, string> = {
    platform: sanitizeTemplateValue(item.platform),
    author: sanitizeTemplateValue(item.author),
    id: sanitizeTemplateValue(item.id),
    title: sanitizeTemplateValue(item.title),
    date: sanitizeTemplateValue(item.publishDate),
  };

  let output =
    settings.fileNameTemplate ||
    '{platform}_{author}_{id}_{title}';

  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(
      `{${key}}`,
      value,
    );
  }

  return (
    sanitizeTemplateValue(output) ||
    sanitizeTemplateValue(item.title) ||
    item.id
  );
}

function parseSpeedToMegabytes(
  speed?: string,
): number {
  if (!speed) {
    return 0;
  }

  const match = speed.match(
    /([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB)\/s/i,
  );

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();

  if (!Number.isFinite(amount)) {
    return 0;
  }

  switch (unit) {
    case 'KIB':
      return amount / 1024;
    case 'MIB':
      return amount;
    case 'GIB':
      return amount * 1024;
    case 'KB':
      return amount / 1000;
    case 'MB':
      return amount;
    case 'GB':
      return amount * 1000;
    default:
      return 0;
  }
}

async function runDownload(
  item: MediaItem,
): Promise<void> {
  if (activeDownloads.has(item.id)) {
    return;
  }

  const controller = new AbortController();

  activeDownloads.set(
    item.id,
    controller,
  );

  updateQueueItem({
    ...item,
    status: 'downloading',
    progress: 0,
    downloadSpeed: '0 B/s',
    eta: '--:--',
  });

  addLog(
    'info',
    'Downloader',
    `Bắt đầu tải: ${item.title}`,
  );

  try {
    const result = await downloadMedia({
      url: item.url,
      outputDirectory: getDownloadDirectory(),
      fileNameTemplate: buildFileName(item),
      audioOnly: item.mediaType === 'audio',
      signal: controller.signal,
      onProgress: (progress) => {
        const currentItem = getQueue().find(
          (queueItem) => queueItem.id === item.id,
        );

        if (!currentItem) {
          return;
        }

        updateQueueItem({
          ...currentItem,
          status: 'downloading',
          progress: Math.round(progress.percentage),
          downloadSpeed: progress.speed,
          eta: progress.eta,
          estimatedSize:
            progress.totalBytes ||
            currentItem.estimatedSize,
        });
      },
    });

    const completedItem: MediaItem = {
      ...item,
      status: 'completed',
      progress: 100,
      downloadSpeed: undefined,
      eta: undefined,
      filePath: result.filePath,
    };

    updateQueueItem(completedItem);
    addHistory(completedItem);

    addLog(
      'info',
      'Downloader',
      `Tải hoàn tất: ${result.fileName}`,
    );
  } catch (error) {
    const currentItem =
      getQueue().find(
        (queueItem) => queueItem.id === item.id,
      ) || item;

    const aborted =
      controller.signal.aborted;

    const abortAction =
      downloadAbortActions.get(item.id);

    const wasSuppressed =
      suppressedDownloadUpdates.has(item.id);

    if (!wasSuppressed) {
      updateQueueItem({
        ...currentItem,
        status:
          aborted
            ? abortAction === 'cancel'
              ? 'cancelled'
              : 'paused'
            : 'failed',
        downloadSpeed: undefined,
        eta: undefined,
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (!wasSuppressed) {
      addLog(
        aborted ? 'warning' : 'error',
        'Downloader',
        aborted
          ? abortAction === 'cancel'
            ? `Đã hủy tải: ${item.title}`
            : `Đã tạm dừng tải: ${item.title}`
          : `Tải thất bại: ${item.title}. ${message}`,
      );
    }
  } finally {
    activeDownloads.delete(item.id);
    downloadAbortActions.delete(item.id);
    suppressedDownloadUpdates.delete(item.id);

    setTimeout(() => {
      void processQueue();
    }, 100);
  }
}

async function processQueue(): Promise<void> {
  if (schedulerRunning || queuePaused) {
    return;
  }

  schedulerRunning = true;

  try {
    while (!queuePaused) {
      const settings = getSettings();
      const queue = getQueue();

      const slotsAvailable = Math.max(
        0,
        settings.concurrentDownloads -
          activeDownloads.size,
      );

      if (slotsAvailable === 0) {
        break;
      }

      const pendingItems = queue
        .filter((item) => item.status === 'pending')
        .slice(0, slotsAvailable);

      if (pendingItems.length === 0) {
        break;
      }

      for (const item of pendingItems) {
        void runDownload(item);
      }

      await sleep(250);
    }
  } finally {
    schedulerRunning = false;
  }
}

app.post(
  '/api/facebook/session',
  (req, res) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    );

    const configuredKey =
      process.env.FACEBOOK_HELPER_KEY;

    const providedKey =
      req.header('x-facebook-helper-key');

    if (
      !configuredKey ||
      providedKey !== configuredKey
    ) {
      return res.status(401).json({
        error:
          'Mã ghép nối Facebook Helper không hợp lệ.',
      });
    }

    const body = req.body as {
      cookies?: unknown;
      userAgent?: unknown;
    };

    if (!Array.isArray(body.cookies)) {
      return res.status(400).json({
        error:
          'Danh sách cookie Facebook không hợp lệ.',
      });
    }

    const cookies =
      body.cookies
        .slice(0, 100)
        .filter(
          (
            item,
          ): item is Record<
            string,
            unknown
          > =>
            typeof item === 'object' &&
            item !== null,
        )
        .map((item) => ({
          name:
            typeof item.name === 'string'
              ? item.name
              : '',
          value:
            typeof item.value === 'string'
              ? item.value
              : '',
          domain:
            typeof item.domain === 'string'
              ? item.domain
              : '',
          path:
            typeof item.path === 'string'
              ? item.path
              : '/',
          secure:
            typeof item.secure === 'boolean'
              ? item.secure
              : undefined,
          httpOnly:
            typeof item.httpOnly ===
            'boolean'
              ? item.httpOnly
              : undefined,
          sameSite:
            typeof item.sameSite ===
            'string'
              ? item.sameSite
              : undefined,
          expirationDate:
            typeof item.expirationDate ===
            'number'
              ? item.expirationDate
              : undefined,
        }))
        .filter(
          (cookie) =>
            cookie.name.length > 0 &&
            cookie.value.length > 0 &&
            cookie.domain.includes(
              'facebook.com',
            ),
        );

    const cookieNames = new Set(
      cookies.map(
        (cookie) => cookie.name,
      ),
    );

    if (
      !cookieNames.has('c_user') ||
      !cookieNames.has('xs')
    ) {
      return res.status(400).json({
        error:
          'Phiên Facebook thiếu cookie c_user hoặc xs.',
      });
    }

    const facebookBrowserSession =
      setFacebookBrowserSession(
        cookies,
        typeof body.userAgent === 'string'
          ? body.userAgent.slice(0, 500)
          : undefined,
      );

    addLog(
      'info',
      'FacebookHelper',
      `Đã nhận phiên Facebook từ trình duyệt (${cookies.length} cookie).`,
    );

    return res.json({
      success: true,
      cookieCount: cookies.length,
      receivedAt:
        facebookBrowserSession.receivedAt,
    });
  },
);

app.get(
  '/api/facebook/session/status',
  (_req, res) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    );

    const facebookBrowserSession =
      getFacebookBrowserSession();

    return res.json({
      connected:
        facebookBrowserSession !== null,
      cookieCount:
        facebookBrowserSession
          ?.cookies.length || 0,
      receivedAt:
        facebookBrowserSession
          ?.receivedAt || null,
    });
  },
);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'socialdownloader',
    ytDlp: true,
    ffmpeg: true,
  });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  saveSettings(req.body);

  res.json({
    success: true,
    settings: getSettings(),
  });
});

app.get('/api/logs', (_req, res) => {
  res.json(getLogs());
});

app.post('/api/logs/clear', (_req, res) => {
  clearLogs();

  res.json({
    success: true,
  });
});

app.get('/api/history', (_req, res) => {
  res.json(getHistory());
});

app.post('/api/history/delete', (req, res) => {
  const { id } = req.body as {
    id?: string;
  };

  if (!id) {
    return res.status(400).json({
      error: 'Thiếu ID lịch sử.',
    });
  }

  removeHistoryItem(id);

  return res.json({
    success: true,
  });
});

app.post('/api/history/clear', (_req, res) => {
  clearHistory();

  res.json({
    success: true,
  });
});

app.get('/api/queue', (_req, res) => {
  res.json(getQueue());
});

app.post('/api/queue/add', (req, res) => {
  const { items } = req.body as {
    items?: MediaItem[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Danh sách tải trống.',
    });
  }

  const currentQueue = getQueue();

  const existingIds = new Set(
    currentQueue.map((item) => item.id),
  );

  const newItems = items
    .filter((item) => !existingIds.has(item.id))
    .map(
      (item): MediaItem => ({
        ...item,
        status: 'pending',
        progress: 0,
        downloadSpeed: undefined,
        eta: undefined,
        filePath: undefined,
      }),
    );

  const queue = [
    ...currentQueue,
    ...newItems,
  ];

  saveQueue(queue);

  addLog(
    'info',
    'Queue',
    `Đã thêm ${newItems.length} tác vụ tải.`,
  );

  void processQueue();

  return res.json({
    success: true,
    queue,
  });
});

app.post('/api/queue/action', (req, res) => {
  const {
    id,
    action,
  } = req.body as {
    id?: string;
    action?:
      | 'pause'
      | 'resume'
      | 'cancel'
      | 'delete'
      | 'restart';
  };

  if (!id || !action) {
    return res.status(400).json({
      error: 'Thiếu ID hoặc hành động.',
    });
  }

  let queue = getQueue();

  const item = queue.find(
    (queueItem) => queueItem.id === id,
  );

  if (!item) {
    return res.status(404).json({
      error: 'Không tìm thấy tác vụ.',
    });
  }

  if (action === 'pause' || action === 'cancel') {
    downloadAbortActions.set(
      id,
      action === 'cancel'
        ? 'cancel'
        : 'pause',
    );

    activeDownloads.get(id)?.abort();

    queue = queue.map((queueItem) =>
      queueItem.id === id
        ? {
            ...queueItem,
            status: 'paused',
            downloadSpeed: undefined,
            eta: undefined,
          }
        : queueItem,
    );
  }

  if (action === 'delete') {
    downloadAbortActions.set(id, 'cancel');
    suppressedDownloadUpdates.add(id);
    activeDownloads.get(id)?.abort();

    queue = queue.filter(
      (queueItem) => queueItem.id !== id,
    );
  }

  if (action === 'resume' || action === 'restart') {
    queue = queue.map((queueItem) =>
      queueItem.id === id
        ? {
            ...queueItem,
            status: 'pending',
            progress:
              action === 'restart'
                ? 0
                : queueItem.progress,
            downloadSpeed: undefined,
            eta: undefined,
          }
        : queueItem,
    );
  }

  saveQueue(queue);

  if (action === 'resume' || action === 'restart') {
    void processQueue();
  }

  return res.json({
    success: true,
    queue,
  });
});

app.post('/api/queue/bulk-action', (req, res) => {
  const { action } = req.body as {
    action?:
      | 'pause'
      | 'resume'
      | 'cancel'
      | 'clear';
  };

  if (!action) {
    return res.status(400).json({
      error: 'Thiếu hành động hàng đợi.',
    });
  }

  let queue = getQueue();

  if (action === 'pause') {
    queuePaused = true;

    for (const [id, controller] of activeDownloads) {
      downloadAbortActions.set(id, 'pause');
      controller.abort();
    }

    queue = queue.map((item) =>
      item.status === 'pending' ||
      item.status === 'downloading'
        ? {
            ...item,
            status: 'paused',
            downloadSpeed: undefined,
            eta: undefined,
          }
        : item,
    );

    addLog(
      'warning',
      'Queue',
      'Đã tạm dừng toàn bộ hàng đợi tải.',
    );
  }

  if (action === 'resume') {
    queuePaused = false;

    queue = queue.map((item) =>
      item.status === 'paused'
        ? {
            ...item,
            status: 'pending',
            downloadSpeed: undefined,
            eta: undefined,
          }
        : item,
    );

    addLog(
      'info',
      'Queue',
      'Đã tiếp tục toàn bộ hàng đợi tải.',
    );
  }

  if (action === 'cancel') {
    queuePaused = true;

    for (const [id, controller] of activeDownloads) {
      downloadAbortActions.set(id, 'cancel');
      controller.abort();
    }

    queue = queue.map((item) =>
      item.status === 'pending' ||
      item.status === 'downloading' ||
      item.status === 'paused'
        ? {
            ...item,
            status: 'cancelled',
            downloadSpeed: undefined,
            eta: undefined,
          }
        : item,
    );

    addLog(
      'warning',
      'Queue',
      'Đã dừng toàn bộ tác vụ tải.',
    );
  }

  if (action === 'clear') {
    queuePaused = true;

    const removableIds = new Set(
      queue
        .filter(
          (item) =>
            item.status === 'pending' ||
            item.status === 'downloading' ||
            item.status === 'paused',
        )
        .map((item) => item.id),
    );

    for (const [id, controller] of activeDownloads) {
      if (!removableIds.has(id)) {
        continue;
      }

      downloadAbortActions.set(id, 'cancel');
      suppressedDownloadUpdates.add(id);
      controller.abort();
    }

    queue = queue.filter(
      (item) => !removableIds.has(item.id),
    );

    addLog(
      'warning',
      'Queue',
      'Đã xóa toàn bộ tiến trình đang tải.',
    );
  }

  saveQueue(queue);

  if (action === 'resume') {
    void processQueue();
  }

  return res.json({
    success: true,
    queue,
    paused: queuePaused,
  });
});

app.post('/api/queue/clear-completed', (req, res) => {
  const { ids } = req.body as {
    ids?: string[];
  };

  const finishedStatuses = new Set([
    'completed',
    'failed',
    'cancelled',
  ]);

  const selectedIds = Array.isArray(ids)
    ? new Set(
        ids.filter(
          (id): id is string =>
            typeof id === 'string',
        ),
      )
    : null;

  const queue = getQueue().filter((item) => {
    if (!finishedStatuses.has(item.status)) {
      return true;
    }

    if (!selectedIds) {
      return false;
    }

    return !selectedIds.has(item.id);
  });

  saveQueue(queue);

  addLog(
    'info',
    'Queue',
    selectedIds
      ? `Đã xóa ${selectedIds.size} tác vụ đã chọn.`
      : 'Đã xóa toàn bộ tác vụ hoàn thành, lỗi và đã dừng.',
  );

  res.json({
    success: true,
    queue,
  });
});

app.post('/api/channel/scan/start', (req, res) => {
  const { url } = req.body as {
    url?: string;
  };

  const cleanUrl = url?.trim();

  if (
    !cleanUrl ||
    !/^https?:\/\//i.test(cleanUrl)
  ) {
    return res.status(400).json({
      error:
        'Link kênh hoặc tài khoản không hợp lệ.',
    });
  }

  const sessionId = crypto.randomUUID();

  const session: ChannelScanSession = {
    id: sessionId,
    url: cleanUrl,
    status: 'scanning',
    items: [],
    stopRequested: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  channelScanSessions.set(
    sessionId,
    session,
  );

  addLog(
    'info',
    'ChannelScanner',
    'Đã bắt đầu phiên quét nền.',
  );

  void runChannelScan(sessionId);

  return res.json({
    sessionId,
    status: session.status,
    batchSize: CHANNEL_SCAN_BATCH_SIZE,
  });
});

app.get('/api/channel/scan/:id', (req, res) => {
  const session = channelScanSessions.get(
    req.params.id,
  );

  if (!session) {
    return res.status(404).json({
      error: 'Không tìm thấy phiên quét.',
    });
  }

  const rawAfter = Number(req.query.after);

  const after =
    Number.isFinite(rawAfter) && rawAfter > 0
      ? Math.floor(rawAfter)
      : 0;

  return res.json({
    sessionId: session.id,
    status: session.status,
    totalLoaded: session.items.length,
    items: session.items.slice(after),
    error: session.error,
    updatedAt: session.updatedAt,
  });
});

app.post('/api/channel/scan/:id/stop', (req, res) => {
  const session = channelScanSessions.get(
    req.params.id,
  );

  if (!session) {
    return res.status(404).json({
      error: 'Không tìm thấy phiên quét.',
    });
  }

  session.stopRequested = true;

  if (session.status === 'scanning') {
    session.status = 'stopped';
  }

  session.updatedAt = Date.now();

  addLog(
    'warning',
    'ChannelScanner',
    `Đã yêu cầu dừng tại ${session.items.length} bài.`,
  );

  return res.json({
    success: true,
    status: session.status,
    totalLoaded: session.items.length,
  });
});

app.post('/api/channel/analyze', async (req, res) => {
  const {
    url,
    limit,
  } = req.body as {
    url?: string;
    limit?: number;
  };

  const cleanUrl = url?.trim();

  if (
    !cleanUrl ||
    !/^https?:\/\//i.test(cleanUrl)
  ) {
    return res.status(400).json({
      error: 'Link kênh hoặc tài khoản không hợp lệ.',
    });
  }

  const normalizedLimit =
    typeof limit === 'number' &&
    Number.isFinite(limit) &&
    limit > 0
      ? Math.floor(limit)
      : undefined;

  addLog(
    'info',
    'ChannelAnalyzer',
    normalizedLimit
      ? `Đang quét tối đa ${normalizedLimit} bài từ kênh.`
      : 'Đang quét toàn bộ bài công khai từ kênh.',
  );

  try {
    const results = await analyzeChannel(
      cleanUrl,
      normalizedLimit,
    );

    if (results.length === 0) {
      return res.status(404).json({
        error:
          'Không tìm thấy bài đăng công khai nào trong kênh.',
      });
    }

    const items: MediaItem[] = results.map(
      (result): MediaItem => ({
        id: result.id,
        url: result.url,
        platform:
          detectPlatform(
            result.platform,
            result.platform,
          ),
        title: result.title,
        author: result.author,
        thumbnail: result.thumbnail,
        mediaType: result.mediaType,
        publishDate:
          result.publishDate ||
          new Date().toLocaleDateString('vi-VN'),
        duration: result.duration,
        resolution:
          result.resolution ||
          'Tự động',
        estimatedSize:
          result.estimatedSize,
        status: 'ready',
        progress: 0,
        selected: true,
      }),
    );

    addLog(
      'info',
      'ChannelAnalyzer',
      `Đã tìm thấy ${items.length} bài công khai.`,
    );

    return res.json(items);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    addLog(
      'error',
      'ChannelAnalyzer',
      message,
    );

    return res.status(500).json({
      error:
        'Không quét được kênh. Hãy kiểm tra liên kết, quyền truy cập hoặc cookie.',
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { urls } = req.body as {
    urls?: string[];
  };

  const validUrls = Array.isArray(urls)
    ? urls
        .map((url) => url.trim())
        .filter((url) =>
          /^https?:\/\//i.test(url),
        )
    : [];

  if (validUrls.length === 0) {
    return res.status(400).json({
      error: 'Không có URL hợp lệ.',
    });
  }

  if (validUrls.length > 20) {
    return res.status(400).json({
      error: 'Chỉ hỗ trợ tối đa 20 URL mỗi lần.',
    });
  }

  addLog(
    'info',
    'Analyzer',
    `Đang phân tích ${validUrls.length} URL.`,
  );

  const results = await Promise.allSettled(
    validUrls.map(async (url): Promise<MediaItem> => {
      const analyzed = await analyzeUrl(url);

      return {
        ...analyzed,
        platform:
          analyzed.platform as PlatformType,
        resolution:
          analyzed.resolution ||
          'Tự động',
        publishDate:
          analyzed.publishDate ||
          '',
        status: 'ready',
        progress: 0,
        selected: true,
      };
    }),
  );

  const items: MediaItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(result.value);
    } else {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);

      addLog(
        'error',
        'Analyzer',
        message,
      );
    }
  }

  if (items.length === 0) {
    return res.status(400).json({
      error:
        'Không phân tích được URL nào. Hãy kiểm tra liên kết hoặc quyền truy cập.',
    });
  }

  addLog(
    'info',
    'Analyzer',
    `Phân tích thành công ${items.length}/${validUrls.length} URL.`,
  );

  return res.json(items);
});

app.get('/api/files/:id', async (req, res) => {
  const item =
    getHistory().find(
      (historyItem) =>
        historyItem.id === req.params.id,
    ) ||
    getQueue().find(
      (queueItem) =>
        queueItem.id === req.params.id,
    );

  if (!item?.filePath) {
    return res.status(404).json({
      error: 'Không tìm thấy file.',
    });
  }

  const resolvedPath = path.resolve(
    item.filePath,
  );

  try {
    await fs.access(resolvedPath);
  } catch {
    return res.status(404).json({
      error:
        'File không còn tồn tại trên Codespaces.',
    });
  }

  return res.download(
    resolvedPath,
    path.basename(resolvedPath),
  );
});

app.get('/api/stats', (_req, res) => {
  const history = getHistory();
  const queue = getQueue();

  const completedDownloads =
    history.filter(
      (item) => item.status === 'completed',
    ).length;

  const failedDownloads =
    queue.filter(
      (item) => item.status === 'failed',
    ).length;

  const downloadingItems =
    queue.filter(
      (item) => item.status === 'downloading',
    );

  const totalSpeed = downloadingItems.reduce(
    (sum, item) =>
      sum + parseSpeedToMegabytes(
        item.downloadSpeed,
      ),
    0,
  );

  const stats: DashboardStats = {
    totalDownloads:
      history.length + queue.length,
    completedDownloads,
    failedDownloads,
    queueCount:
      queue.filter(
        (item) =>
          item.status === 'pending' ||
          item.status === 'downloading' ||
          item.status === 'paused',
      ).length,
    diskUsedGB: 0,
    diskFreeGB: 0,
    todayDownloads:
      history.filter((item) => {
        const today =
          new Date().toLocaleDateString('vi-VN');

        return item.publishDate === today;
      }).length,
    currentSpeed:
      totalSpeed > 0
        ? `${totalSpeed.toFixed(1)} MB/s`
        : '0 B/s',
    queueStatus:
      downloadingItems.length > 0
        ? 'running'
        : queue.some(
            (item) => item.status === 'paused',
          )
          ? 'paused'
          : 'idle',
  };

  res.json(stats);
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/downloads/**',
          ],
        },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');

    app.use(
      express.static(distPath),
    );

    app.get('*', (_req, res) => {
      res.sendFile(
        path.join(distPath, 'index.html'),
      );
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    addLog(
      'info',
      'System',
      `Server started on port ${PORT}.`,
    );

    console.log(
      `Social Downloader running on http://localhost:${PORT}`,
    );
  });

  void processQueue();
}

void startServer();
