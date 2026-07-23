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
  type AnalyzeResult,
} from './backend/services/analyzeService';

import {
  MediaItem,
  DashboardStats,
  PlatformType,
} from './src/types';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({
  limit: '1mb',
}));

const activeDownloads = new Map<string, AbortController>();
let schedulerRunning = false;

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

const CHANNEL_SCAN_BATCH_SIZE = 100;

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

    const cancelled = controller.signal.aborted;

    updateQueueItem({
      ...currentItem,
      status: cancelled ? 'paused' : 'failed',
      downloadSpeed: undefined,
      eta: undefined,
    });

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    addLog(
      cancelled ? 'warning' : 'error',
      'Downloader',
      cancelled
        ? `Đã dừng tải: ${item.title}`
        : `Tải thất bại: ${item.title}. ${message}`,
    );
  } finally {
    activeDownloads.delete(item.id);

    setTimeout(() => {
      void processQueue();
    }, 100);
  }
}

async function processQueue(): Promise<void> {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    while (true) {
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

app.post('/api/queue/clear-completed', (_req, res) => {
  const queue = getQueue().filter(
    (item) =>
      item.status !== 'completed' &&
      item.status !== 'failed',
  );

  saveQueue(queue);

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
