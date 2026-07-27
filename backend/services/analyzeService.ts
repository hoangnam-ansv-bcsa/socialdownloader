import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { chromium } from 'playwright';
import {
  getFacebookPlaywrightCookies,
} from './facebookSessionStore';

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

function isFacebookUrl(url: string): boolean {
  const hostname = getHostname(url);

  return (
    hostname === 'facebook.com' ||
    hostname.endsWith('.facebook.com')
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

function isFacebookSingleMediaUrl(
  url: string,
): boolean {
  if (!isFacebookUrl(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const pathname =
      parsedUrl.pathname.replace(/\/+$/, '');

    if (
      /^\/reel\/[^/]+$/i.test(pathname) ||
      /^\/share\/(?:r|v)\/[^/]+$/i.test(pathname) ||
      /\/videos\/[^/]+$/i.test(pathname)
    ) {
      return true;
    }

    if (
      pathname === '/watch' &&
      parsedUrl.searchParams.has('v')
    ) {
      return true;
    }

    if (
      pathname.startsWith('/photo') &&
      parsedUrl.searchParams.has('fbid')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function isFacebookPhotoUrl(url: string): boolean {
  const hostname = getHostname(url);

  if (
    hostname !== 'facebook.com' &&
    !hostname.endsWith('.facebook.com')
  ) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.pathname.startsWith('/photo') &&
      parsedUrl.searchParams.has('fbid')
    );
  } catch {
    return false;
  }
}

function isInstagramPostUrl(url: string): boolean {
  const hostname = getHostname(url);

  if (
    hostname !== 'instagram.com' &&
    !hostname.endsWith('.instagram.com')
  ) {
    return false;
  }

  try {
    return new URL(url).pathname.startsWith('/p/');
  } catch {
    return false;
  }
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

async function loadFacebookBrowserCookies() {
  const browserCookies =
    getFacebookPlaywrightCookies();

  if (browserCookies.length > 0) {
    return browserCookies;
  }

  const cookiesPath = path.resolve(
    process.env.YT_DLP_COOKIES ||
      'secrets/cookies.txt',
  );

  try {
    const cookieText = await fs.readFile(
      cookiesPath,
      'utf8',
    );

    return cookieText
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();

        return (
          trimmed.length > 0 &&
          (
            !trimmed.startsWith('#') ||
            trimmed.startsWith('#HttpOnly_')
          )
        );
      })
      .map((line) => {
        const parts = line.split('\t');

        if (parts.length < 7) {
          return null;
        }

        const [
          rawDomain,
          ,
          cookiePath,
          secure,
          expires,
          name,
          ...valueParts
        ] = parts;

        const domain = rawDomain.replace(
          /^#HttpOnly_/,
          '',
        );

        if (!domain.includes('facebook.com')) {
          return null;
        }

        return {
          name,
          value: valueParts.join('\t'),
          domain,
          path: cookiePath || '/',
          secure: secure === 'TRUE',
          expires:
            Number(expires) > 0
              ? Number(expires)
              : -1,
        };
      })
      .filter(
        (
          cookie,
        ): cookie is NonNullable<typeof cookie> =>
          cookie !== null,
      );
  } catch {
    return [];
  }
}

async function analyzeFacebookPhoto(
  url: string,
): Promise<AnalyzeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    const cookies =
      await loadFacebookBrowserCookies();

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForTimeout(10_000);

    if (page.url().includes('/login/')) {
      throw new Error(
        'Cookie Facebook đã hết hạn hoặc không có quyền xem bài viết.',
      );
    }

    const collected =
      new Map<string, string>();

    let title = '';
    let author = 'Facebook';

    for (
      let round = 0;
      round < 30;
      round += 1
    ) {
      const data = await page.evaluate(() => {
        const images = Array.from(
          document.querySelectorAll<HTMLImageElement>(
            'img',
          ),
        )
          .map((image) => ({
            src:
              image.currentSrc ||
              image.src,
            width: image.naturalWidth,
            height: image.naturalHeight,
          }))
          .filter(
            (image) =>
              image.src.includes('scontent') &&
              image.src.includes('fbcdn.net') &&
              image.width >= 500 &&
              image.height >= 500,
          )
          .map((image) => image.src);

        const ogTitle =
          document
            .querySelector<HTMLMetaElement>(
              'meta[property="og:title"]',
            )
            ?.content ||
          '';

        const ogDescription =
          document
            .querySelector<HTMLMetaElement>(
              'meta[property="og:description"]',
            )
            ?.content ||
          '';

        return {
          images,
          ogTitle,
          ogDescription,
          documentTitle: document.title,
        };
      });

      for (const imageUrl of data.images) {
        collected.set(
          imageUrl.split('?')[0],
          imageUrl,
        );
      }

      if (!title) {
        title =
          data.ogDescription ||
          data.ogTitle ||
          data.documentTitle ||
          'Bài ảnh Facebook';
      }

      if (
        author === 'Facebook' &&
        data.ogTitle
      ) {
        author =
          data.ogTitle
            .replace(/\s*\|\s*Facebook.*$/i, '')
            .trim() ||
          'Facebook';
      }

      const clicked =
        await page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll<HTMLElement>(
              '[aria-label]',
            ),
          );

          const next = elements.find(
            (element) => {
              const label =
                element.getAttribute(
                  'aria-label',
                ) || '';

              return /next|tiếp|sau/i.test(
                label,
              );
            },
          );

          if (!next) {
            return false;
          }

          next.click();
          return true;
        });

      if (!clicked) {
        break;
      }

      await page.waitForTimeout(2_000);
    }

    const imageUrls =
      Array.from(collected.values());

    if (imageUrls.length === 0) {
      throw new Error(
        'Không tìm thấy ảnh trong bài Facebook.',
      );
    }

    const parsedUrl = new URL(url);

    const id =
      parsedUrl.searchParams.get('fbid') ||
      randomUUID();

    return {
      id,
      url,
      platform: 'Facebook',
      title,
      author,
      thumbnail: imageUrls[0],
      estimatedSize: 0,
      mediaType:
        imageUrls.length > 1
          ? 'album'
          : 'photo',
    };
  } finally {
    await browser.close();
  }
}

async function loadInstagramBrowserCookies() {
  const cookiesPath = path.resolve(
    process.env.YT_DLP_COOKIES ||
      'secrets/cookies.txt',
  );

  try {
    const cookieText = await fs.readFile(
      cookiesPath,
      'utf8',
    );

    return cookieText
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();

        return (
          trimmed.length > 0 &&
          (
            !trimmed.startsWith('#') ||
            trimmed.startsWith('#HttpOnly_')
          )
        );
      })
      .map((line) => {
        const parts = line.split('\t');

        if (parts.length < 7) {
          return null;
        }

        const [
          rawDomain,
          ,
          cookiePath,
          secure,
          expires,
          name,
          ...valueParts
        ] = parts;

        const domain = rawDomain.replace(
          /^#HttpOnly_/,
          '',
        );

        if (!domain.includes('instagram.com')) {
          return null;
        }

        return {
          name,
          value: valueParts.join('\t'),
          domain,
          path: cookiePath || '/',
          secure: secure === 'TRUE',
          expires:
            Number(expires) > 0
              ? Number(expires)
              : -1,
        };
      })
      .filter(
        (
          cookie,
        ): cookie is NonNullable<typeof cookie> =>
          cookie !== null,
      );
  } catch {
    return [];
  }
}

async function analyzeInstagramPost(
  url: string,
): Promise<AnalyzeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    const cookies =
      await loadInstagramBrowserCookies();

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForTimeout(8_000);

    const data = await page.evaluate(() => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          'img',
        ),
      )
        .filter(
          (image) =>
            (
              image.currentSrc ||
              image.src
            ).includes('cdninstagram.com') &&
            image.naturalWidth >= 500 &&
            image.naturalHeight >= 500,
        )
        .map((image) => ({
          src: image.currentSrc || image.src,
          alt: image.alt || '',
        }));

      const metaDescription =
        document
          .querySelector<HTMLMetaElement>(
            'meta[property="og:description"]',
          )
          ?.content ||
        document
          .querySelector<HTMLMetaElement>(
            'meta[name="description"]',
          )
          ?.content ||
        '';

      const ogTitle =
        document
          .querySelector<HTMLMetaElement>(
            'meta[property="og:title"]',
          )
          ?.content ||
        '';

      return {
        images,
        metaDescription,
        ogTitle,
        title: document.title,
        body: document.body.innerText,
      };
    });

    if (data.images.length === 0) {
      throw new Error(
        'Không tìm thấy ảnh trong bài Instagram.',
      );
    }

    const idMatch = url.match(
      /instagram\.com\/p\/([^/?]+)/i,
    );

    const authorMatch =
      data.ogTitle.match(
        /^(.+?)\s+on Instagram/i,
      ) ||
      data.metaDescription.match(
        /from\s+([^\s:]+)\s+on Instagram/i,
      );

    const author =
      authorMatch?.[1]?.trim() ||
      'Instagram';

    const firstImage = data.images[0];

    const uniqueImageCount = new Set(
      data.images.map(
        (image) =>
          image.src.split('?')[0],
      ),
    ).size;

    return {
      id:
        idMatch?.[1] ||
        randomUUID(),
      url,
      platform: 'Instagram',
      title:
        data.metaDescription ||
        data.ogTitle ||
        data.title ||
        'Bài viết Instagram',
      author,
      thumbnail: firstImage.src,
      estimatedSize: 0,
      mediaType:
        uniqueImageCount > 1
          ? 'album'
          : 'photo',
    };
  } finally {
    await browser.close();
  }
}

export async function analyzeUrl(
  url: string,
): Promise<AnalyzeResult> {
  if (isInstagramPostUrl(url)) {
    return analyzeInstagramPost(url);
  }

  if (isFacebookPhotoUrl(url)) {
    return analyzeFacebookPhoto(url);
  }

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

async function loadTikTokBrowserCookies() {
  const cookiesPath = path.resolve(
    process.env.YT_DLP_COOKIES ||
      'secrets/cookies.txt',
  );

  try {
    const cookieText = await fs.readFile(
      cookiesPath,
      'utf8',
    );

    return cookieText
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();

        return (
          trimmed.length > 0 &&
          (
            !trimmed.startsWith('#') ||
            trimmed.startsWith('#HttpOnly_')
          )
        );
      })
      .map((line) => {
        const parts = line.split('\t');

        if (parts.length < 7) {
          return null;
        }

        const [
          rawDomain,
          ,
          cookiePath,
          secure,
          expires,
          name,
          ...valueParts
        ] = parts;

        const domain = rawDomain.replace(
          /^#HttpOnly_/,
          '',
        );

        if (!domain.includes('tiktok.com')) {
          return null;
        }

        return {
          name,
          value: valueParts.join('\t'),
          domain,
          path: cookiePath || '/',
          secure: secure === 'TRUE',
          expires:
            Number(expires) > 0
              ? Number(expires)
              : -1,
        };
      })
      .filter(
        (
          cookie,
        ): cookie is NonNullable<typeof cookie> =>
          cookie !== null,
      );
  } catch {
    return [];
  }
}

async function analyzeFacebookChannelRange(
  url: string,
  start: number,
  end: number,
): Promise<AnalyzeResult[]> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    const cookies =
      await loadFacebookBrowserCookies();

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForTimeout(10_000);

    if (page.url().includes('/login/')) {
      throw new Error(
        'Cookie Facebook đã hết hạn hoặc không có quyền xem trang cá nhân.',
      );
    }

    const pageMetadata =
      await page.evaluate(() => {
        const ogTitle =
          document
            .querySelector<HTMLMetaElement>(
              'meta[property="og:title"]',
            )
            ?.content ||
          '';

        return {
          title:
            ogTitle ||
            document.title ||
            'Facebook',
        };
      });

    let previousCount = 0;
    let unchangedRounds = 0;

    for (
      let round = 0;
      round < 70;
      round += 1
    ) {
      const currentCount =
        await page.evaluate(() => {
          type FacebookCollectedItem = {
            key: string;
            id: string;
            href: string;
            title: string;
            thumbnail: string;
            mediaType:
              | 'album'
              | 'photo'
              | 'video';
          };

          const extendedWindow =
            window as typeof window & {
              __facebookCollectedItems?: Record<
                string,
                FacebookCollectedItem
              >;
            };

          const store =
            extendedWindow
              .__facebookCollectedItems ||
            {};

          const anchors = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              'a[href]',
            ),
          );

          for (const anchor of anchors) {
            try {
              const parsedUrl =
                new URL(anchor.href);

              const pathname =
                parsedUrl.pathname;

              const image =
                anchor.querySelector<HTMLImageElement>(
                  'img',
                );

              const title =
                image?.alt?.trim() ||
                anchor.getAttribute(
                  'aria-label',
                )?.trim() ||
                anchor.innerText.trim() ||
                'Bài viết Facebook';

              const thumbnail =
                image?.currentSrc ||
                image?.src ||
                '';

              const normalizedTitle =
                title.toLowerCase();

              const isProfileImage =
                normalizedTitle.includes(
                  'profile picture',
                ) ||
                normalizedTitle.includes(
                  'profile cover photo',
                ) ||
                normalizedTitle.includes(
                  'ảnh đại diện',
                ) ||
                normalizedTitle.includes(
                  'ảnh bìa',
                );

              if (
                (
                  pathname.startsWith('/photo/') ||
                  pathname === '/photo.php'
                ) &&
                !isProfileImage
              ) {
                const fbid =
                  parsedUrl.searchParams.get(
                    'fbid',
                  );

                const set =
                  parsedUrl.searchParams.get(
                    'set',
                  );

                if (!fbid) {
                  continue;
                }

                const canonicalUrl =
                  new URL(
                    'https://www.facebook.com/photo/',
                  );

                canonicalUrl.searchParams.set(
                  'fbid',
                  fbid,
                );

                if (set) {
                  canonicalUrl.searchParams.set(
                    'set',
                    set,
                  );
                }

                if (
                  set?.startsWith('pcb.')
                ) {
                  const id = set.slice(4);
                  const key = `album:${id}`;

                  store[key] = {
                    key,
                    id,
                    href:
                      canonicalUrl.toString(),
                    title,
                    thumbnail,
                    mediaType: 'album',
                  };
                } else {
                  const key =
                    `photo:${fbid}`;

                  store[key] = {
                    key,
                    id: fbid,
                    href:
                      canonicalUrl.toString(),
                    title,
                    thumbnail,
                    mediaType: 'photo',
                  };
                }

                continue;
              }

              const reelMatch =
                pathname.match(
                  /^\/reel\/(\d+)/,
                );

              if (reelMatch) {
                const id = reelMatch[1];
                const key = `video:${id}`;

                store[key] = {
                  key,
                  id,
                  href:
                    `https://www.facebook.com/reel/${id}`,
                  title,
                  thumbnail,
                  mediaType: 'video',
                };

                continue;
              }

              const sharedVideoMatch =
                pathname.match(
                  /^\/share\/(?:r|v)\/([^/?]+)/,
                );

              if (sharedVideoMatch) {
                const id = sharedVideoMatch[1];
                const key = `video:share:${id}`;

                store[key] = {
                  key,
                  id,
                  href:
                    `https://www.facebook.com${pathname}`,
                  title,
                  thumbnail,
                  mediaType: 'video',
                };

                continue;
              }

              const watchVideoId =
                pathname === '/watch/'
                  ? parsedUrl.searchParams.get(
                      'v',
                    )
                  : null;

              if (watchVideoId) {
                const key =
                  `video:${watchVideoId}`;

                store[key] = {
                  key,
                  id: watchVideoId,
                  href:
                    `https://www.facebook.com/watch/?v=${watchVideoId}`,
                  title,
                  thumbnail,
                  mediaType: 'video',
                };

                continue;
              }

              const videoMatch =
                pathname.match(
                  /\/videos\/(\d+)/,
                );

              if (videoMatch) {
                const id = videoMatch[1];
                const key = `video:${id}`;

                store[key] = {
                  key,
                  id,
                  href:
                    anchor.href.split('?')[0],
                  title,
                  thumbnail,
                  mediaType: 'video',
                };
              }
            } catch {
              // Bỏ qua đường dẫn không hợp lệ.
            }
          }

          extendedWindow
            .__facebookCollectedItems =
            store;

          return Object.keys(store).length;
        });

      const scrollState =
        await page.evaluate(() => {
          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>('*'),
          )
            .filter((element) => {
              const style =
                window.getComputedStyle(element);

              const overflowY =
                style.overflowY;

              return (
                (
                  overflowY === 'auto' ||
                  overflowY === 'scroll'
                ) &&
                element.scrollHeight >
                  element.clientHeight + 100
              );
            })
            .sort(
              (a, b) =>
                b.scrollHeight -
                a.scrollHeight,
            )
            .slice(0, 5)
            .map((element) => ({
              tag: element.tagName,
              role:
                element.getAttribute('role'),
              ariaLabel:
                element.getAttribute(
                  'aria-label',
                ),
              scrollTop:
                element.scrollTop,
              scrollHeight:
                element.scrollHeight,
              clientHeight:
                element.clientHeight,
            }));

          return {
            scrollY: window.scrollY,
            scrollHeight:
              document.documentElement.scrollHeight,
            clientHeight:
              document.documentElement.clientHeight,
            candidates,
          };
        });

      console.info(
        `[FacebookScroll] vòng ${round + 1}: ${currentCount} mục, y=${scrollState.scrollY}, height=${scrollState.scrollHeight}, containers=${JSON.stringify(scrollState.candidates)}`,
      );

      if (currentCount >= end) {
        break;
      }

      if (currentCount === previousCount) {
        unchangedRounds += 1;
      } else {
        previousCount = currentCount;
        unchangedRounds = 0;
      }

      if (unchangedRounds >= 10) {
        break;
      }

      const scrollAmount =
        unchangedRounds > 0 &&
        unchangedRounds % 4 === 0
          ? 1600
          : 900;

      const scrollTarget =
        await page.evaluate(() => {
          const mediaAnchors = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              'a[href]',
            ),
          ).filter((anchor) => {
            try {
              const parsedUrl =
                new URL(anchor.href);

              const pathname =
                parsedUrl.pathname;

              return (
                pathname.startsWith('/photo') ||
                /^\/reel\/[^/]+/i.test(pathname) ||
                /^\/share\/(?:r|v)\/[^/]+/i.test(pathname) ||
                /\/videos\/[^/]+/i.test(pathname) ||
                (
                  pathname === '/watch/' &&
                  parsedUrl.searchParams.has('v')
                )
              );
            } catch {
              return false;
            }
          });

          const lastAnchor =
            mediaAnchors[
              mediaAnchors.length - 1
            ];

          let current =
            lastAnchor?.parentElement || null;

          let scrollContainer:
            | HTMLElement
            | null = null;

          while (current) {
            const style =
              window.getComputedStyle(current);

            if (
              (
                style.overflowY === 'auto' ||
                style.overflowY === 'scroll'
              ) &&
              current.scrollHeight >
                current.clientHeight + 100
            ) {
              scrollContainer = current;
              break;
            }

            current = current.parentElement;
          }

          if (!scrollContainer) {
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>('*'),
            )
              .filter((element) => {
                const style =
                  window.getComputedStyle(element);

                return (
                  (
                    style.overflowY === 'auto' ||
                    style.overflowY === 'scroll'
                  ) &&
                  element.scrollHeight >
                    element.clientHeight + 100
                );
              })
              .sort(
                (a, b) =>
                  b.scrollHeight -
                  a.scrollHeight,
              );

            scrollContainer =
              candidates[0] || null;
          }

          if (!scrollContainer) {
            return null;
          }

          const rect =
            scrollContainer.getBoundingClientRect();

          return {
            x:
              rect.left +
              Math.max(1, rect.width / 2),
            y:
              rect.top +
              Math.max(1, rect.height / 2),
          };
        });

      if (scrollTarget) {
        await page.mouse.move(
          scrollTarget.x,
          scrollTarget.y,
        );

        await page.mouse.wheel(
          0,
          scrollAmount,
        );
      } else {
        await page.mouse.wheel(
          0,
          scrollAmount,
        );
      }

      await page.waitForTimeout(3_000);
    }

    await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('*'),
      )
        .filter((element) => {
          const style =
            window.getComputedStyle(element);

          return (
            (
              style.overflowY === 'auto' ||
              style.overflowY === 'scroll'
            ) &&
            element.scrollHeight >
              element.clientHeight + 100
          );
        })
        .sort(
          (a, b) =>
            b.scrollHeight -
            a.scrollHeight,
        );

      const scrollContainer =
        candidates[0];

      if (scrollContainer) {
        scrollContainer.scrollBy({
          top: -600,
          behavior: 'instant',
        });
      }
    });

    await page.waitForTimeout(1_500);

    await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('*'),
      )
        .filter((element) => {
          const style =
            window.getComputedStyle(element);

          return (
            (
              style.overflowY === 'auto' ||
              style.overflowY === 'scroll'
            ) &&
            element.scrollHeight >
              element.clientHeight + 100
          );
        })
        .sort(
          (a, b) =>
            b.scrollHeight -
            a.scrollHeight,
        );

      const scrollContainer =
        candidates[0];

      if (scrollContainer) {
        scrollContainer.scrollBy({
          top: 600,
          behavior: 'instant',
        });
      }
    });

    await page.waitForTimeout(2_000);

    const rawItems =
      await page.evaluate(() => {
        type FacebookCollectedItem = {
          key: string;
          id: string;
          href: string;
          title: string;
          thumbnail: string;
          mediaType:
            | 'album'
            | 'photo'
            | 'video';
        };

        const extendedWindow =
          window as typeof window & {
            __facebookCollectedItems?: Record<
              string,
              FacebookCollectedItem
            >;
          };

        return Object.values(
          extendedWindow
            .__facebookCollectedItems ||
            {},
        );
      });

    const uniqueItems = Array.from(
      new Map(
        rawItems.map((item) => [
          item.key,
          item,
        ]),
      ).values(),
    );

    if (uniqueItems.length === 0) {
      throw new Error(
        'Không lấy được danh sách ảnh hoặc video Facebook. Cookie có thể đã hết hạn hoặc Facebook đang yêu cầu xác minh.',
      );
    }

    const author =
      pageMetadata.title
        .replace(/\s*\|\s*Facebook.*$/i, '')
        .replace(/\s*-\s*Facebook.*$/i, '')
        .trim() ||
      'Facebook';

    return uniqueItems
      .slice(start - 1, end)
      .map((item) => ({
        id: item.id,
        url: item.href,
        platform: 'Facebook',
        title: item.title,
        author,
        thumbnail: item.thumbnail,
        estimatedSize: 0,
        mediaType: item.mediaType,
      }));
  } finally {
    await browser.close();
  }
}

async function analyzeTikTokChannelRange(
  url: string,
  start: number,
  end: number,
): Promise<AnalyzeResult[]> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    const cookies =
      await loadTikTokBrowserCookies();

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForTimeout(8_000);

    let previousCount = 0;
    let unchangedRounds = 0;

    for (
      let round = 0;
      round < 120;
      round += 1
    ) {
      const currentCount =
        await page.locator(
          'a[href*="/video/"], a[href*="/photo/"]',
        ).count();

      if (currentCount >= end) {
        break;
      }

      if (currentCount === previousCount) {
        unchangedRounds += 1;
      } else {
        unchangedRounds = 0;
        previousCount = currentCount;
      }

      if (unchangedRounds >= 6) {
        break;
      }

      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(1_500);
    }

    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(2_000);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(3_000);

    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/video/"], a[href*="/photo/"]',
          ),
        ).some((anchor) => {
          const image =
            anchor.querySelector<HTMLImageElement>(
              'img',
            );

          return Boolean(
            image?.currentSrc ||
            image?.src,
          );
        }),
      {
        timeout: 15_000,
      },
    ).catch(() => undefined);

    const rawItems = await page.evaluate(() => {
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="/video/"], a[href*="/photo/"]',
        ),
      );

      return anchors.map((anchor) => {
        const image =
          anchor.querySelector<HTMLImageElement>(
            'img',
          );

        const href =
          anchor.href.split('?')[0];

        const title =
          image?.alt?.trim() ||
          anchor.getAttribute(
            'aria-label',
          )?.trim() ||
          anchor.innerText.trim() ||
          'Không có tiêu đề';

        return {
          href,
          title,
          thumbnail:
            image?.currentSrc ||
            image?.src ||
            '',
        };
      });
    });

    const uniqueItems = Array.from(
      new Map(
        rawItems.map((item) => [
          item.href,
          item,
        ]),
      ).values(),
    );

    if (uniqueItems.length === 0) {
      throw new Error(
        'Không lấy được danh sách bài TikTok. Cookie có thể đã hết hạn hoặc TikTok đang yêu cầu CAPTCHA.',
      );
    }

    const authorMatch = url.match(
      /tiktok\.com\/@([^/?]+)/i,
    );

    const author = authorMatch?.[1]
      ? `@${authorMatch[1]}`
      : 'TikTok';

    const mappedItems = uniqueItems
      .slice(start - 1, end)
      .map((item) => {
        const idMatch = item.href.match(
          /\/(?:video|photo)\/(\d+)/,
        );

        const isPhoto =
          item.href.includes('/photo/');

        return {
          id:
            idMatch?.[1] ||
            randomUUID(),
          url: item.href,
          platform: 'TikTok',
          title: item.title,
          author,
          thumbnail: item.thumbnail,
          estimatedSize: 0,
          mediaType: isPhoto
            ? 'album' as const
            : 'video' as const,
        };
      });

    for (const item of mappedItems) {
      const needsMetadata =
        item.mediaType === 'video' &&
        (
          item.title === 'Không có tiêu đề' ||
          !item.thumbnail
        );

      if (!needsMetadata) {
        continue;
      }

      try {
        const enriched =
          await analyzeUrl(item.url);

        item.title = enriched.title;
        item.thumbnail =
          enriched.thumbnail;
        item.estimatedSize =
          enriched.estimatedSize;
      } catch {
        // Giữ dữ liệu cơ bản nếu TikTok từ chối yêu cầu bổ sung.
      }
    }

    return mappedItems;
  } finally {
    await browser.close();
  }
}

export function isFacebookProfileRootUrl(
  url: string,
): boolean {
  try {
    const parsedUrl = new URL(url);

    const segments =
      parsedUrl.pathname
        .split('/')
        .filter(Boolean);

    if (segments.length !== 1) {
      return false;
    }

    const reservedPaths = new Set([
      'photo',
      'photo.php',
      'reel',
      'reels',
      'videos',
      'watch',
      'share',
      'groups',
      'pages',
      'marketplace',
      'stories',
    ]);

    return !reservedPaths.has(
      segments[0].toLowerCase(),
    );
  } catch {
    return false;
  }
}

type FacebookTabProgressCallback = (
  items: AnalyzeResult[],
  tabUrl: string,
) => void | Promise<void>;

async function analyzeFacebookProfileTabsRange(
  url: string,
  start: number,
  end: number,
  onTabProgress?: FacebookTabProgressCallback,
): Promise<AnalyzeResult[]> {
  const parsedUrl = new URL(url);

  const profilePath =
    parsedUrl.pathname.replace(
      /\/+$/,
      '',
    );

  const profileBaseUrl =
    `${parsedUrl.origin}${profilePath}`;

  const tabUrls = [
    profileBaseUrl,
    `${profileBaseUrl}/photos`,
    `${profileBaseUrl}/reels`,
    `${profileBaseUrl}/videos`,
  ];

  const collected =
    new Map<string, AnalyzeResult>();

  const errors: string[] = [];

  for (const tabUrl of tabUrls) {
    try {
      const results =
        await analyzeFacebookChannelRange(
          tabUrl,
          1,
          end,
        );

      console.info(
        `[FacebookTabs] ${tabUrl}: ${results.length} bài`,
      );

      const newItems: AnalyzeResult[] = [];

      for (const item of results) {
        const key =
          `${item.mediaType}:${item.id || item.url}`;

        if (!collected.has(key)) {
          collected.set(key, item);
          newItems.push(item);
        }
      }

      if (
        onTabProgress &&
        newItems.length > 0
      ) {
        await onTabProgress(
          newItems,
          tabUrl,
        );
      }

      const isLastTab =
        tabUrl === tabUrls[tabUrls.length - 1];

      if (!isLastTab) {
        console.info(
          '[FacebookTabs] Nghỉ 8 giây trước tab tiếp theo.',
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 8_000),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Không thể quét ${tabUrl}`;

      console.warn(
        `[FacebookTabs] Lỗi ${tabUrl}: ${message}`,
      );

      errors.push(message);
    }
  }

  const items =
    Array.from(collected.values());

  if (items.length === 0) {
    throw new Error(
      errors[0] ||
        'Không lấy được nội dung từ trang Facebook.',
    );
  }

  return items.slice(
    start - 1,
    end,
  );
}

export async function analyzeChannelRange(
  url: string,
  start: number,
  end: number,
  onFacebookTabProgress?: FacebookTabProgressCallback,
): Promise<AnalyzeResult[]> {
  const normalizedStart = Math.max(
    1,
    Math.floor(start),
  );

  const normalizedEnd = Math.max(
    normalizedStart,
    Math.floor(end),
  );

  if (isTikTokUrl(url)) {
    return analyzeTikTokChannelRange(
      url,
      normalizedStart,
      normalizedEnd,
    );
  }

  if (isFacebookUrl(url)) {
    if (isFacebookProfileRootUrl(url)) {
      return analyzeFacebookProfileTabsRange(
        url,
        normalizedStart,
        normalizedEnd,
        onFacebookTabProgress,
      );
    }

    if (isFacebookSingleMediaUrl(url)) {
      if (normalizedStart > 1) {
        return [];
      }

      const item = await analyzeUrl(url);

      return [item].slice(
        normalizedStart - 1,
        normalizedEnd,
      );
    }

    return analyzeFacebookChannelRange(
      url,
      normalizedStart,
      normalizedEnd,
    );
  }

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

