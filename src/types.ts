export type PlatformType =
  | 'TikTok'
  | 'Facebook'
  | 'Instagram'
  | 'Douyin'
  | 'Xiaohongshu'
  | 'Kuaishou'
  | 'Bilibili'
  | 'YouTube'
  | 'Pinterest';

export interface MediaItem {
  id: string;
  url: string;
  platform: PlatformType;
  title: string;
  author: string;
  thumbnail: string;
  mediaType: 'video' | 'photo' | 'album' | 'audio';
  publishDate: string;
  duration?: string; // e.g., "01:24"
  resolution: string; // e.g., "1080p", "4K"
  estimatedSize: number; // in bytes
  status: 'pending' | 'analyzing' | 'ready' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';
  progress: number; // 0 to 100
  downloadSpeed?: string; // e.g., "2.4 MB/s"
  eta?: string; // e.g., "00:15"
  filePath?: string;
  selected?: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'vi';
  defaultDownloadFolder: string;
  concurrentDownloads: number;
  retryCount: number;
  timeoutSeconds: number;
  autoUpdateChecker: boolean;
  fileNameTemplate: string; // e.g. "{platform}_{author}_{date}_{title}"
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  module: string;
  message: string;
}

export interface DashboardStats {
  totalDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  queueCount: number;
  diskUsedGB: number;
  diskFreeGB: number;
  todayDownloads: number;
  currentSpeed: string;
  queueStatus: 'running' | 'paused' | 'idle';
}
