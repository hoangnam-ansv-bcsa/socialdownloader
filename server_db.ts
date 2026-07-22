import fs from 'node:fs';
import path from 'node:path';
import {
  AppSettings,
  LogEntry,
  MediaItem,
} from './src/types';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DOWNLOAD_DIR = path.join(ROOT_DIR, 'downloads');

fs.mkdirSync(DATA_DIR, {
  recursive: true,
});

fs.mkdirSync(DOWNLOAD_DIR, {
  recursive: true,
});

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'vi',
  defaultDownloadFolder: DOWNLOAD_DIR,
  concurrentDownloads: 2,
  retryCount: 3,
  timeoutSeconds: 120,
  autoUpdateChecker: true,
  fileNameTemplate: '{platform}_{author}_{id}_{title}',
};

function readJsonFile<T>(
  filePath: string,
  fallbackValue: T,
): T {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      JSON.stringify(fallbackValue, null, 2),
      'utf-8',
    );

    return fallbackValue;
  }

  try {
    const rawData = fs.readFileSync(
      filePath,
      'utf-8',
    );

    return JSON.parse(rawData) as T;
  } catch {
    return fallbackValue;
  }
}

function writeJsonFile<T>(
  filePath: string,
  value: T,
): void {
  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2),
    'utf-8',
  );
}

export function getSettings(): AppSettings {
  const settings = readJsonFile<AppSettings>(
    SETTINGS_FILE,
    defaultSettings,
  );

  const invalidWindowsPath =
    settings.defaultDownloadFolder.includes('\\') ||
    /^[A-Za-z]:/.test(settings.defaultDownloadFolder);

  if (invalidWindowsPath) {
    const correctedSettings: AppSettings = {
      ...settings,
      defaultDownloadFolder: DOWNLOAD_DIR,
    };

    writeJsonFile(
      SETTINGS_FILE,
      correctedSettings,
    );

    return correctedSettings;
  }

  return settings;
}

export function saveSettings(
  settings: AppSettings,
): void {
  const normalizedFolder =
    settings.defaultDownloadFolder.trim() ||
    DOWNLOAD_DIR;

  fs.mkdirSync(normalizedFolder, {
    recursive: true,
  });

  writeJsonFile(
    SETTINGS_FILE,
    {
      ...settings,
      defaultDownloadFolder: normalizedFolder,
    },
  );
}

export function getLogs(): LogEntry[] {
  return readJsonFile<LogEntry[]>(
    LOGS_FILE,
    [],
  );
}

export function addLog(
  level: LogEntry['level'],
  module: string,
  message: string,
): void {
  const logs = getLogs();

  const newLog: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };

  writeJsonFile(
    LOGS_FILE,
    [newLog, ...logs].slice(0, 500),
  );
}

export function clearLogs(): void {
  writeJsonFile(
    LOGS_FILE,
    [],
  );
}

export function getHistory(): MediaItem[] {
  return readJsonFile<MediaItem[]>(
    HISTORY_FILE,
    [],
  );
}

export function addHistory(
  item: MediaItem,
): void {
  const history = getHistory();

  const completedItem: MediaItem = {
    ...item,
    status: 'completed',
    progress: 100,
  };

  const existingIndex = history.findIndex(
    (historyItem) => historyItem.id === item.id,
  );

  if (existingIndex >= 0) {
    history[existingIndex] = completedItem;
  } else {
    history.unshift(completedItem);
  }

  writeJsonFile(
    HISTORY_FILE,
    history,
  );
}

export function removeHistoryItem(
  id: string,
): void {
  writeJsonFile(
    HISTORY_FILE,
    getHistory().filter(
      (item) => item.id !== id,
    ),
  );
}

export function clearHistory(): void {
  writeJsonFile(
    HISTORY_FILE,
    [],
  );
}

export function getQueue(): MediaItem[] {
  return readJsonFile<MediaItem[]>(
    QUEUE_FILE,
    [],
  );
}

export function saveQueue(
  queue: MediaItem[],
): void {
  writeJsonFile(
    QUEUE_FILE,
    queue,
  );
}

export function updateQueueItem(
  item: MediaItem,
): void {
  const queue = getQueue();

  const index = queue.findIndex(
    (queueItem) => queueItem.id === item.id,
  );

  if (index >= 0) {
    queue[index] = item;
  } else {
    queue.push(item);
  }

  saveQueue(queue);
}

export function getDownloadDirectory(): string {
  const settings = getSettings();
  const downloadDirectory =
    settings.defaultDownloadFolder ||
    DOWNLOAD_DIR;

  fs.mkdirSync(downloadDirectory, {
    recursive: true,
  });

  return downloadDirectory;
}
