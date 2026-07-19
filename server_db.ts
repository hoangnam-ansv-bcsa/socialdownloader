import fs from 'fs';
import path from 'path';
import { AppSettings, LogEntry, MediaItem, DashboardStats } from './src/types';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultDownloadFolder: 'C:\\Users\\Hoang Nam\\Downloads',
  concurrentDownloads: 5,
  retryCount: 3,
  timeoutSeconds: 30,
  autoUpdateChecker: true,
  fileNameTemplate: '{platform}_{author}_{id}_{title}',
};

export function getSettings(): AppSettings {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function getLogs(): LogEntry[] {
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export function addLog(level: LogEntry['level'], module: string, message: string): void {
  const logs = getLogs();
  const newLog: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };
  logs.unshift(newLog); // Newest first
  // Limit to 500 logs
  const trimmed = logs.slice(0, 500);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2));
}

export function clearLogs(): void {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
}

export function getHistory(): MediaItem[] {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export function addHistory(item: MediaItem): void {
  const history = getHistory();
  // Avoid duplicate history entries
  const existingIndex = history.findIndex((h) => h.id === item.id);
  if (existingIndex > -1) {
    history[existingIndex] = { ...item, status: 'completed' };
  } else {
    history.unshift({ ...item, status: 'completed' });
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export function removeHistoryItem(id: string): void {
  let history = getHistory();
  history = history.filter((h) => h.id !== id);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export function clearHistory(): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

export function getQueue(): MediaItem[] {
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export function saveQueue(queue: MediaItem[]): void {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

export function updateQueueItem(item: MediaItem): void {
  const queue = getQueue();
  const index = queue.findIndex((q) => q.id === item.id);
  if (index > -1) {
    queue[index] = item;
    saveQueue(queue);
  }
}
