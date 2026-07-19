import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
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
} from './server_db';
import { MediaItem, DashboardStats, PlatformType } from './src/types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

if (ai) {
  addLog('info', 'System', 'Gemini AI Client initialized successfully for media analysis.');
} else {
  addLog('warning', 'System', 'Gemini API key not found. Using local heuristic parser for media analysis.');
}

// Global active workers array to control simulated parallel downloads
let downloadInterval: NodeJS.Timeout | null = null;

function startDownloadScheduler() {
  if (downloadInterval) return;

  downloadInterval = setInterval(() => {
    const queue = getQueue();
    const settings = getSettings();
    const downloadingCount = queue.filter((item) => item.status === 'downloading').length;
    const pendingItems = queue.filter((item) => item.status === 'pending');

    // Fill workers up to concurrent limit
    const slotsAvailable = settings.concurrentDownloads - downloadingCount;
    if (slotsAvailable > 0 && pendingItems.length > 0) {
      const itemsToStart = pendingItems.slice(0, slotsAvailable);
      itemsToStart.forEach((item) => {
        item.status = 'downloading';
        item.progress = 0;
        item.downloadSpeed = '0 KB/s';
        item.eta = '--:--';
        updateQueueItem(item);
        addLog('info', 'Downloader', `Started downloading: [${item.platform}] ${item.title}`);
      });
    }

    // Process downloading items
    let hasChanges = false;
    const currentQueue = getQueue();
    const updatedQueue = currentQueue.map((item) => {
      if (item.status === 'downloading') {
        hasChanges = true;
        const speedNum = (Math.random() * 4 + 1.5).toFixed(1); // 1.5 MB/s to 5.5 MB/s
        item.downloadSpeed = `${speedNum} MB/s`;

        // Advance progress
        const increment = Math.floor(Math.random() * 15) + 5;
        const newProgress = Math.min(item.progress + increment, 100);
        item.progress = newProgress;

        // Calculate ETA
        const remainingBytes = item.estimatedSize * (1 - newProgress / 100);
        const speedBytes = parseFloat(speedNum) * 1024 * 1024;
        const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;
        item.eta = etaSeconds > 0 ? `00:${etaSeconds.toString().padStart(2, '0')}` : '00:00';

        if (newProgress >= 100) {
          item.status = 'completed';
          item.downloadSpeed = undefined;
          item.eta = undefined;
          // Add file path simulation based on platform and title
          const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 30);
          const ext = item.mediaType === 'photo' || item.mediaType === 'album' ? 'jpg' : 'mp4';
          item.filePath = `${settings.defaultDownloadFolder}/${item.platform}/${item.author}/${item.mediaType === 'video' ? 'Videos' : 'Images'}/${safeTitle}.${ext}`;

          addLog('info', 'Downloader', `Successfully downloaded: ${item.title}`);
          addHistory(item); // Save to completed history
        }
      }
      return item;
    });

    if (hasChanges) {
      // Remove completed or failed items from active download queue automatically or keep them but update state?
      // Keeping completed in active queue is good for showing them in the active UI, but we can filter them or remove them.
      // Let's filter out completed items and move them to history, or keep them with 'completed' state in queue so user can see they finished.
      saveQueue(updatedQueue);
    }
  }, 1000);
}

// Start scheduler on launch
startDownloadScheduler();

// API: Stats
app.get('/api/stats', (req, res) => {
  const history = getHistory();
  const queue = getQueue();
  const settings = getSettings();

  const completed = history.filter((h) => h.status === 'completed').length;
  const failed = history.filter((h) => h.status === 'failed').length;
  const downloading = queue.filter((q) => q.status === 'downloading');

  const totalSpeed = downloading.reduce((sum, item) => {
    if (item.downloadSpeed) {
      const mbs = parseFloat(item.downloadSpeed.split(' ')[0]);
      return sum + (isNaN(mbs) ? 0 : mbs);
    }
    return sum;
  }, 0);

  const stats: DashboardStats = {
    totalDownloads: completed + failed + queue.length,
    completedDownloads: completed,
    failedDownloads: failed,
    queueCount: queue.filter((q) => q.status === 'pending' || q.status === 'downloading').length,
    diskUsedGB: parseFloat((34.2 + completed * 0.08).toFixed(1)),
    diskFreeGB: parseFloat((215.8 - completed * 0.08).toFixed(1)),
    todayDownloads: history.filter((h) => {
      const d = new Date(h.publishDate);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
    currentSpeed: totalSpeed > 0 ? `${totalSpeed.toFixed(1)} MB/s` : '0 KB/s',
    queueStatus: queue.some((q) => q.status === 'downloading') ? 'running' : queue.some((q) => q.status === 'paused') ? 'paused' : 'idle',
  };

  res.json(stats);
});

// Helper for local regex based parsing (fallback)
function localHeuristicParse(url: string): MediaItem {
  let platform: PlatformType = 'YouTube';
  let mediaType: MediaItem['mediaType'] = 'video';
  let resolution = '1080p';
  let duration = '00:30';

  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) {
    platform = 'TikTok';
    duration = '00:15';
    resolution = '1080p';
  } else if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    platform = 'Facebook';
    duration = '02:45';
  } else if (lower.includes('instagram.com')) {
    platform = 'Instagram';
    mediaType = lower.includes('/p/') ? 'photo' : 'video';
    duration = mediaType === 'photo' ? '' : '00:59';
  } else if (lower.includes('douyin.com')) {
    platform = 'Douyin';
    duration = '00:45';
  } else if (lower.includes('xiaohongshu.com') || lower.includes('xhslink.com')) {
    platform = 'Xiaohongshu';
    mediaType = 'photo';
    duration = '';
  } else if (lower.includes('kuaishou.com')) {
    platform = 'Kuaishou';
    duration = '00:55';
  } else if (lower.includes('bilibili.com')) {
    platform = 'Bilibili';
    duration = '05:30';
    resolution = '1080p';
  } else if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be')) {
    platform = 'YouTube';
    duration = '00:40';
  } else if (lower.includes('pinterest.com')) {
    platform = 'Pinterest';
    mediaType = 'photo';
    duration = '';
  }

  // Generate beautiful Unsplash thumbnail topics based on platform
  const topics: Record<PlatformType, string> = {
    TikTok: 'dance,creative,vertical',
    Facebook: 'community,family,live',
    Instagram: 'travel,aesthetic,fashion',
    Douyin: 'city,food,technology',
    Xiaohongshu: 'lifestyle,skincare,cafe',
    Kuaishou: 'rural,comedy,vlog',
    Bilibili: 'anime,gaming,review',
    YouTube: 'vlog,cinematic,education',
    Pinterest: 'design,minimalist,interiors',
  };

  const topic = topics[platform] || 'media';
  const randomId = Math.floor(Math.random() * 1000);
  const thumbnail = `https://images.unsplash.com/photo-${1600000000000 + randomId}?w=300&auto=format&fit=crop&q=60&sig=${randomId}&q=${encodeURIComponent(topic)}`;

  const mockTitles = [
    `Unbelievable ${platform} Content Creator Showcase`,
    `A Day in My Life Vlog | Trending Media`,
    `How to master viral hooks in 5 minutes`,
    `Hidden gems you must visit right now`,
    `Reviewing the latest setup upgrades`,
    `Amazing photography ideas for beginners`,
    `Viral recipe that everyone is talking about`,
  ];
  const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];

  const mockAuthors = ['@lucas_vlog', '@creative_emma', 'Hoang Nam', '@aesthetic_vibes', 'MediaMaster', '@trend_setter'];
  const author = mockAuthors[Math.floor(Math.random() * mockAuthors.length)];

  return {
    id: Math.random().toString(36).substring(2, 9),
    url,
    platform,
    title,
    author,
    thumbnail,
    mediaType,
    publishDate: new Date().toLocaleDateString(),
    duration: duration || undefined,
    resolution,
    estimatedSize: Math.floor(Math.random() * 80000000) + 10000000,
    status: 'ready',
    progress: 0,
    selected: true,
  };
}

// API: Analyze URL
app.post('/api/analyze', async (req, res) => {
  const { urls }: { urls: string[] } = req.body;
  if (!urls || urls.length === 0) {
    return res.status(400).json({ error: 'No URLs provided' });
  }

  addLog('info', 'Scraper', `Analyzing ${urls.length} media URLs.`);

  // If Gemini is available, use it! Otherwise, fall back to heuristic.
  if (ai) {
    try {
      const promptText = `Analyze these social media links and return the structured JSON array: ${JSON.stringify(urls)}`;
      const systemInstruction = `You are an expert social media scraper and link analyst.
Given the following URLs, identify which social media platform each belongs to.
Supported platforms are: TikTok, Facebook, Instagram, Douyin, Xiaohongshu, Kuaishou, Bilibili, YouTube, Pinterest.
For each URL, generate highly realistic metadata based on typical content from that platform.
Make sure the thumbnails use high quality uncopyrighted imagery (use beautiful unsplash links e.g. https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300).
The result MUST be a valid JSON array of objects, with each object having the following fields:
- url (string): the exact URL passed in.
- platform (string): one of the supported platforms.
- title (string): a realistic, captivating title of the post/video/album.
- author (string): a realistic username or author handle (e.g. @creative_mind, Hoang Nam, etc.).
- thumbnail (string): a valid Unsplash image URL.
- mediaType (string): 'video', 'photo', 'album', or 'audio'.
- publishDate (string): a neat date.
- duration (string): duration if video (e.g., "00:45", "12:30"), omit or empty string if photo.
- resolution (string): typical resolution (e.g., "1080p", "4K", "720p").
- estimatedSize (number): estimated size of the media in bytes (e.g., between 5,000,000 and 150,000,000).
- status (string): must be 'ready'.
- progress (number): 0.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                platform: { type: Type.STRING },
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                thumbnail: { type: Type.STRING },
                mediaType: { type: Type.STRING },
                publishDate: { type: Type.STRING },
                duration: { type: Type.STRING },
                resolution: { type: Type.STRING },
                estimatedSize: { type: Type.INTEGER },
              },
              required: ['url', 'platform', 'title', 'author', 'thumbnail', 'mediaType', 'publishDate', 'resolution', 'estimatedSize'],
            },
          },
        },
      });

      const parsedItems: any[] = JSON.parse(response.text || '[]');
      const items: MediaItem[] = parsedItems.map((item) => ({
        id: Math.random().toString(36).substring(2, 9),
        url: item.url,
        platform: item.platform as PlatformType,
        title: item.title,
        author: item.author,
        thumbnail: item.thumbnail,
        mediaType: item.mediaType as MediaItem['mediaType'],
        publishDate: item.publishDate,
        duration: item.duration || undefined,
        resolution: item.resolution,
        estimatedSize: item.estimatedSize,
        status: 'ready',
        progress: 0,
        selected: true,
      }));

      addLog('info', 'Scraper', `Successfully analyzed ${items.length} URLs using Gemini AI.`);
      return res.json(items);
    } catch (err: any) {
      addLog('error', 'Scraper', `Gemini AI analysis failed: ${err.message || err}. Falling back to offline heuristic parser.`);
      // Fallback
      const items = urls.map((url) => localHeuristicParse(url));
      return res.json(items);
    }
  } else {
    // Regular mock
    const items = urls.map((url) => localHeuristicParse(url));
    addLog('info', 'Scraper', `Successfully analyzed ${items.length} URLs using offline heuristic parser.`);
    return res.json(items);
  }
});

// API: Queue management
app.get('/api/queue', (req, res) => {
  res.json(getQueue());
});

app.post('/api/queue/add', (req, res) => {
  const { items }: { items: MediaItem[] } = req.body;
  const currentQueue = getQueue();

  const newItems = items.map((item) => ({
    ...item,
    status: 'pending' as const,
    progress: 0,
  }));

  const merged = [...currentQueue, ...newItems];
  saveQueue(merged);

  addLog('info', 'Queue', `Added ${items.length} items to the download queue.`);
  res.json({ success: true, queue: merged });
});

app.post('/api/queue/action', (req, res) => {
  const { id, action }: { id: string; action: 'pause' | 'resume' | 'cancel' | 'delete' | 'restart' } = req.body;
  let queue = getQueue();

  if (action === 'delete') {
    queue = queue.filter((q) => q.id !== id);
    saveQueue(queue);
    addLog('info', 'Queue', `Removed task [${id}] from queue.`);
  } else {
    queue = queue.map((q) => {
      if (q.id === id) {
        if (action === 'pause') {
          q.status = 'paused';
          addLog('info', 'Queue', `Paused task: ${q.title}`);
        } else if (action === 'resume') {
          q.status = 'pending';
          addLog('info', 'Queue', `Resumed task: ${q.title}`);
        } else if (action === 'restart') {
          q.status = 'pending';
          q.progress = 0;
          addLog('info', 'Queue', `Restarted task: ${q.title}`);
        }
      }
      return q;
    });
    saveQueue(queue);
  }

  res.json({ success: true, queue });
});

app.post('/api/queue/clear-completed', (req, res) => {
  let queue = getQueue();
  queue = queue.filter((q) => q.status !== 'completed' && q.status !== 'failed');
  saveQueue(queue);
  addLog('info', 'Queue', 'Cleared all completed tasks from the active queue views.');
  res.json({ success: true, queue });
});

// API: Settings
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  saveSettings(settings);
  addLog('info', 'Settings', 'Application settings updated.');
  res.json({ success: true, settings });
});

// API: History
app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

app.post('/api/history/delete', (req, res) => {
  const { id } = req.body;
  removeHistoryItem(id);
  addLog('info', 'History', `Deleted history item [${id}].`);
  res.json({ success: true });
});

app.post('/api/history/clear', (req, res) => {
  clearHistory();
  addLog('info', 'History', 'Cleared all download history.');
  res.json({ success: true });
});

// API: Logs
app.get('/api/logs', (req, res) => {
  res.json(getLogs());
});

app.post('/api/logs/clear', (req, res) => {
  clearLogs();
  addLog('info', 'Logs', 'Cleared developer diagnostic logs.');
  res.json({ success: true });
});

// Vite Setup for dev / Production Build Serve
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
