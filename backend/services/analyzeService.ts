import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

export interface AnalyzeResult {
  id: string;
  url: string;
  platform: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
  resolution?: string;
  estimatedSize: number;
  mediaType: 'video' | 'photo' | 'album' | 'audio';
  publishDate?: string;
}

interface YtDlpEntry {
  id?: string;
  url?: string;
  webpage_url?: string;
  original_url?: string;
  extractor?: string;
  extractor_key?: string;
  title?: string;
  description?: string;
  uploader?: string;
  uploader_id?: string;
  channel?: string;
  thumbnail?: string;
  thumbnails?: Array<{
    url?: string;
  }>;
  duration?: number;
  width?: number;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  upload_date?: string;
  timestamp?: number;
  ext?: string;
  entries?: YtDlpEntry[];
}

const YT_DLP_BINARY =
  process.env.YT_DLP_BINARY || 'yt-dlp';

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isTikTokUrl(url: string): boolean {
  const hostname = getHostname(url);

  return (
    hostname === 'tiktok.com' ||
    hostname.endsWith('.tiktok.com')
  );
}

function isYouTubeUrl(url: string): boolean {
  const hostname = getHostname(url);

  return (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtu.be' ||
    hostname.endsWith('.youtu.be')
  );
}

function addPlatformArguments(
  args: string[],
  url: string,
): void {
  if (isTikTokUrl(url)) {
    args.push(
      '--impersonate',
      'Chrome-131:MacOS-14',
    );
  }

  if (isYouTubeUrl(url)) {
    args.push(
      '--js-runtimes',
      'node',
      '--remote-components',
      'ejs:github',
    );
  }
}

async function addCookiesIfAvailable(
  args: string[],
): Promise<void> {
  const cookiesPath = path.resolve(
    process.env.YT_DLP_COOKIES ||
      'secrets/cookies.txt',
  );

  try {
    await fs.access(cookiesPath);
    args.push('--cookies', cookiesPath);
  } catch {
    // Nội dung công khai vẫn có thể hoạt động mà không cần cookie.
  }
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

  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(
    (seconds % 3600) / 60,
  );
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((value) =>
        String(value).padStart(2, '0'),
      )
      .join(':');
  }

  return [minutes, remainingSeconds]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':');
}

function formatPublishDate(
  entry: YtDlpEntry,
): string | undefined {
  if (
    entry.upload_date &&
    /^\d{8}$/.test(entry.upload_date)
  ) {
    const year = entry.upload_date.slice(0, 4);
    const month = entry.upload_date.slice(4, 6);
    const day = entry.upload_date.slice(6, 8);

    return `${day}/${month}/${year}`;
  }

  if (
    entry.timestamp &&
    Number.isFinite(entry.timestamp)
  ) {
    return new Date(
      entry.timestamp * 1000,
    ).toLocaleDateString('vi-VN');
  }

  return undefined;
}

function detectPlatform(
  entry: YtDlpEntry,
): string {
  const source = [
    entry.extractor,
    entry.extractor_key,
    entry.webpage_url,
    entry.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('youtube')) return 'YouTube';
  if (source.includes('youtu.be')) return 'YouTube';
  if (source.includes('bilibili')) return 'Bilibili';
  if (source.includes('pinterest')) return 'Pinterest';
  if (source.includes('douyin')) return 'Douyin';
  if (source.includes('xiaohongshu')) {
    return 'Xiaohongshu';
  }
  if (source.includes('kuaishou')) return 'Kuaishou';

  return entry.extractor || 'Unknown';
}

function detectMediaType(
  entry: YtDlpEntry,
): AnalyzeResult['mediaType'] {
  if (
    Array.isArray(entry.entries) &&
    entry.entries.length > 1
  ) {
    return 'album';
  }

  const extension = entry.ext?.toLowerCase();

  if (
    extension &&
    ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(
      extension,
    )
  ) {
    return 'photo';
  }

  if (
    extension &&
    ['mp3', 'm4a', 'aac', 'wav', 'flac'].includes(
      extension,
    )
  ) {
    return 'audio';
  }

  return 'video';
}

function getThumbnail(
  entry: YtDlpEntry,
): string {
  if (entry.thumbnail) {
    return entry.thumbnail;
  }

  const thumbnails =
    entry.thumbnails?.filter(
      (thumbnail) => Boolean(thumbnail.url),
    ) || [];

  return (
    thumbnails.at(-1)?.url ||
    thumbnails[0]?.url ||
    ''
  );
}

function getEntryUrl(
  entry: YtDlpEntry,
  sourceUrl: string,
): string {
  const candidate =
    entry.webpage_url ||
    entry.original_url ||
    entry.url ||
    sourceUrl;

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (
    isTikTokUrl(sourceUrl) &&
    entry.id
  ) {
    const channel =
      entry.uploader_id ||
      entry.uploader ||
      '';

    if (channel) {
      const normalizedChannel =
        channel.startsWith('@')
          ? channel
          : `@${channel}`;

      return `https://www.tiktok.com/${normalizedChannel}/video/${entry.id}`;
    }
  }

  return sourceUrl;
}

function mapEntry(
  entry: YtDlpEntry,
  sourceUrl: string,
): AnalyzeResult {
  return {
    id:
      entry.id ||
      randomUUID(),
    url: getEntryUrl(
      entry,
      sourceUrl,
    ),
    platform: detectPlatform(entry),
    title:
      entry.title ||
      entry.description ||
      'Không có tiêu đề',
    author:
      entry.uploader ||
      entry.channel ||
      entry.uploader_id ||
      'Không xác định',
    thumbnail: getThumbnail(entry),
    duration: formatDuration(entry.duration),
    resolution:
      entry.height
        ? `${entry.height}p`
        : undefined,
    estimatedSize:
      entry.filesize ||
      entry.filesize_approx ||
      0,
    mediaType: detectMediaType(entry),
    publishDate: formatPublishDate(entry),
  };
}

export async function analyzeUrl(
  url: string,
): Promise<AnalyzeResult> {
  const args: string[] = [
    '--dump-single-json',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
  ];

  addPlatformArguments(args, url);
  await addCookiesIfAvailable(args);

  args.push(url);

  const result = await execa(
    YT_DLP_BINARY,
    args,
    {
      timeout: 120_000,
      maxBuffer: 30 * 1024 * 1024,
    },
  );

  const data = JSON.parse(
    result.stdout,
  ) as YtDlpEntry;

  return mapEntry(data, url);
}

export async function analyzeChannel(
  url: string,
  limit?: number,
): Promise<AnalyzeResult[]> {
  const args: string[] = [
    '--dump-single-json',
    '--flat-playlist',
    '--skip-download',
    '--no-warnings',
    '--sleep-requests',
    '2',
    '--extractor-retries',
    '10',
    '--retry-sleep',
    'extractor:5',
  ];

  if (
    limit !== undefined &&
    Number.isFinite(limit) &&
    limit > 0
  ) {
    args.push(
      '--playlist-end',
      String(Math.floor(limit)),
    );
  }

  addPlatformArguments(args, url);
  await addCookiesIfAvailable(args);

  args.push(url);

  const result = await execa(
    YT_DLP_BINARY,
    args,
    {
      timeout: 10 * 60 * 1000,
      maxBuffer: 200 * 1024 * 1024,
    },
  );

  const data = JSON.parse(
    result.stdout,
  ) as YtDlpEntry;

  const entries = Array.isArray(data.entries)
    ? data.entries
    : [];

  return entries
    .filter(
      (entry): entry is YtDlpEntry =>
        Boolean(entry && entry.id),
    )
    .map((entry) => {
      const enrichedEntry: YtDlpEntry = {
        ...entry,
        extractor:
          entry.extractor ||
          data.extractor,
        extractor_key:
          entry.extractor_key ||
          data.extractor_key,
        uploader:
          entry.uploader ||
          data.uploader,
        uploader_id:
          entry.uploader_id ||
          data.uploader_id,
        channel:
          entry.channel ||
          data.channel,
      };

      return mapEntry(
        enrichedEntry,
        url,
      );
    });
}

export async function analyzeChannelRange(
  url: string,
  start: number,
  end: number,
): Promise<AnalyzeResult[]> {
  const normalizedStart = Math.max(
    1,
    Math.floor(start),
  );

  const normalizedEnd = Math.max(
    normalizedStart,
    Math.floor(end),
  );

  const args: string[] = [
    '--dump-single-json',
    '--flat-playlist',
    '--skip-download',
    '--no-warnings',
    '--playlist-items',
    `${normalizedStart}:${normalizedEnd}`,
    '--sleep-requests',
    '2',
    '--extractor-retries',
    '10',
    '--retry-sleep',
    'extractor:5',
  ];

  addPlatformArguments(args, url);
  await addCookiesIfAvailable(args);

  args.push(url);

  const result = await execa(
    YT_DLP_BINARY,
    args,
    {
      timeout: 10 * 60 * 1000,
      maxBuffer: 100 * 1024 * 1024,
    },
  );

  const data = JSON.parse(
    result.stdout,
  ) as YtDlpEntry;

  const entries = Array.isArray(data.entries)
    ? data.entries
    : [];

  return entries
    .filter(
      (entry): entry is YtDlpEntry =>
        Boolean(entry && entry.id),
    )
    .map((entry) => {
      const enrichedEntry: YtDlpEntry = {
        ...entry,
        extractor:
          entry.extractor ||
          data.extractor,
        extractor_key:
          entry.extractor_key ||
          data.extractor_key,
        uploader:
          entry.uploader ||
          data.uploader,
        uploader_id:
          entry.uploader_id ||
          data.uploader_id,
        channel:
          entry.channel ||
          data.channel,
      };

      return mapEntry(
        enrichedEntry,
        url,
      );
    });
}

