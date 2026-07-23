import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

export interface YtDlpMetadata {
  id?: string;
  webpage_url?: string;
  original_url?: string;
  extractor?: string;
  extractor_key?: string;
  title?: string;
  uploader?: string;
  uploader_id?: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  upload_date?: string;
  ext?: string;
  photo_count?: number;
}

export interface DownloadProgress {
  percentage: number;
  speed: string;
  eta: string;
  downloadedBytes?: number;
  totalBytes?: number;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
}

export interface DownloadMediaOptions {
  url: string;
  outputDirectory: string;
  fileNameTemplate?: string;
  audioOnly?: boolean;
  cookiesFile?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
}

const YT_DLP_BINARY = process.env.YT_DLP_BINARY || 'yt-dlp';

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
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

function isTikTokUrl(url: string): boolean {
  const hostname = getHostname(url);

  return (
    hostname === 'tiktok.com' ||
    hostname.endsWith('.tiktok.com')
  );
}

function isTikTokPhotoUrl(url: string): boolean {
  if (!isTikTokUrl(url)) {
    return false;
  }

  try {
    return new URL(url).pathname.includes('/photo/');
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

function addPlatformArguments(
  args: string[],
  url: string,
): void {
  if (isYouTubeUrl(url)) {
    args.push(
      '--js-runtimes',
      'node',
      '--remote-components',
      'ejs:github',
    );
  }

  if (isTikTokUrl(url)) {
    args.push(
      '--impersonate',
      'Chrome-131:MacOS-14',
    );
  }
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  return cleaned || 'download';
}

function parseNumber(value?: string): number | undefined {
  if (!value || value === 'NA' || value === 'None') {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getTikTokPhotoMetadata(
  url: string,
): Promise<YtDlpMetadata> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 120_000,
    });

    await page.waitForTimeout(10_000);

    const payload = await page.evaluate(() => {
      const imageEntries = Array.from(document.images)
        .map((image) => {
          const htmlImage = image as HTMLImageElement;

          return {
            src:
              htmlImage.currentSrc ||
              htmlImage.src,
            width:
              htmlImage.naturalWidth,
            height:
              htmlImage.naturalHeight,
            alt:
              htmlImage.alt || '',
          };
        })
        .filter((image) =>
          image.src.includes('photomode'),
        );

      const uniqueImages = Array.from(
        new Map(
          imageEntries.map((image) => [
            image.src.split('?')[0],
            image,
          ]),
        ).values(),
      );

      const cleanTitle = document.title
        .replace(/\s*\|\s*TikTok\s*$/, '')
        .trim();

      const metaDescription =
        (
          document.querySelector(
            'meta[name="description"]',
          ) as HTMLMetaElement | null
        )?.content?.trim() || '';

      return {
        title: cleanTitle,
        metaDescription,
        images: uniqueImages,
      };
    });

    if (payload.images.length === 0) {
      throw new Error(
        'Không phân tích được bài ảnh TikTok. Trang có thể đang yêu cầu CAPTCHA.',
      );
    }

    const idMatch = url.match(
      /\/photo\/(\d+)/,
    );

    const authorMatch = url.match(
      /tiktok\.com\/@([^/?]+)/i,
    );

    const firstImage = payload.images[0];

    return {
      id: idMatch?.[1],
      webpage_url: url,
      original_url: url,
      extractor: 'TikTokPhoto',
      extractor_key: 'TikTokPhoto',
      title:
        payload.title ||
        payload.metaDescription ||
        'TikTok photo post',
      uploader: authorMatch?.[1]
        ? `@${authorMatch[1]}`
        : 'TikTok',
      uploader_id: authorMatch?.[1],
      channel: authorMatch?.[1]
        ? `@${authorMatch[1]}`
        : undefined,
      thumbnail: firstImage.src,
      width:
        firstImage.width || undefined,
      height:
        firstImage.height || undefined,
      ext: 'jpg',
      photo_count: payload.images.length,
    };
  } finally {
    await browser.close();
  }
}

export async function getMediaMetadata(
  url: string,
): Promise<YtDlpMetadata> {
  if (isTikTokPhotoUrl(url)) {
    return getTikTokPhotoMetadata(url);
  }

  const metadataArgs = [
    '--dump-single-json',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
  ];

  addPlatformArguments(
    metadataArgs,
    url,
  );

  const cookiesPath = path.resolve(
    process.env.YT_DLP_COOKIES || 'secrets/cookies.txt',
  );

  try {
    await fs.access(cookiesPath);
    metadataArgs.push('--cookies', cookiesPath);
  } catch {
    // Public platforms may still work without cookies.
  }

  metadataArgs.push(url);

  const result = await execa(YT_DLP_BINARY, metadataArgs, {
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  const metadata = JSON.parse(result.stdout) as YtDlpMetadata;

  if (!metadata.id && !metadata.title) {
    throw new Error('yt-dlp không trả về metadata hợp lệ.');
  }

  return metadata;
}

async function loadInstagramBrowserCookies(
  cookiesFile?: string,
) {
  const cookiesPath = path.resolve(
    cookiesFile ||
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

async function loadFacebookBrowserCookies(
  cookiesFile?: string,
) {
  const cookiesPath = path.resolve(
    cookiesFile ||
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

async function downloadFacebookPhotoAlbum(
  options: DownloadMediaOptions,
): Promise<DownloadResult> {
  const {
    url,
    outputDirectory,
    fileNameTemplate,
    cookiesFile,
    signal,
    onProgress,
  } = options;

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const baseName = sanitizeFileName(
    fileNameTemplate || 'facebook_album',
  );

  const resolvedOutputDirectory =
    path.resolve(outputDirectory);

  const albumDirectory = path.join(
    resolvedOutputDirectory,
    `${baseName}_images`,
  );

  const zipPath = path.join(
    resolvedOutputDirectory,
    `${baseName}.zip`,
  );

  await fs.rm(albumDirectory, {
    recursive: true,
    force: true,
  });

  await fs.rm(zipPath, {
    force: true,
  });

  await fs.mkdir(albumDirectory, {
    recursive: true,
  });

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
      await loadFacebookBrowserCookies(
        cookiesFile,
      );

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

    for (
      let round = 0;
      round < 30;
      round += 1
    ) {
      if (signal?.aborted) {
        throw new Error(
          'Đã hủy tải album Facebook.',
        );
      }

      const imageUrls =
        await page.evaluate(() =>
          Array.from(
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
            .map((image) => image.src),
        );

      for (const imageUrl of imageUrls) {
        collected.set(
          imageUrl.split('?')[0],
          imageUrl,
        );
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

    for (
      let index = 0;
      index < imageUrls.length;
      index += 1
    ) {
      if (signal?.aborted) {
        throw new Error(
          'Đã hủy tải album Facebook.',
        );
      }

      const response =
        await context.request.get(
          imageUrls[index],
          {
            headers: {
              Referer: url,
            },
            timeout: 120_000,
          },
        );

      if (!response.ok()) {
        throw new Error(
          `Không tải được ảnh ${index + 1}/${imageUrls.length}: HTTP ${response.status()}.`,
        );
      }

      const contentType =
        response.headers()['content-type'] ||
        '';

      const extension =
        contentType.includes('png')
          ? 'png'
          : contentType.includes('webp')
            ? 'webp'
            : 'jpg';

      const fileName =
        `${String(index + 1).padStart(3, '0')}.${extension}`;

      await fs.writeFile(
        path.join(
          albumDirectory,
          fileName,
        ),
        await response.body(),
      );

      onProgress?.({
        percentage:
          ((index + 1) /
            imageUrls.length) *
          90,
        speed: 'Đang tải ảnh',
        eta:
          `${imageUrls.length - index - 1} ảnh`,
      });
    }

    onProgress?.({
      percentage: 95,
      speed: 'Đang đóng gói ZIP',
      eta: '--:--',
    });

    const zipResult = await execa(
      'zip',
      ['-r', '-q', zipPath, '.'],
      {
        cwd: albumDirectory,
        reject: false,
      },
    );

    if (zipResult.exitCode !== 0) {
      throw new Error(
        'Không thể đóng gói album Facebook thành ZIP.',
      );
    }

    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    onProgress?.({
      percentage: 100,
      speed: 'Hoàn tất',
      eta: '00:00',
    });

    return {
      filePath: path.resolve(zipPath),
      fileName: path.basename(zipPath),
    };
  } catch (error) {
    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    throw error;
  } finally {
    await browser.close();
  }
}

async function downloadInstagramPhotoAlbum(
  options: DownloadMediaOptions,
): Promise<DownloadResult> {
  const {
    url,
    outputDirectory,
    fileNameTemplate,
    cookiesFile,
    signal,
    onProgress,
  } = options;

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const baseName = sanitizeFileName(
    fileNameTemplate || 'instagram_album',
  );

  const resolvedOutputDirectory =
    path.resolve(outputDirectory);

  const albumDirectory = path.join(
    resolvedOutputDirectory,
    `${baseName}_images`,
  );

  const zipPath = path.join(
    resolvedOutputDirectory,
    `${baseName}.zip`,
  );

  await fs.rm(albumDirectory, {
    recursive: true,
    force: true,
  });

  await fs.rm(zipPath, {
    force: true,
  });

  await fs.mkdir(albumDirectory, {
    recursive: true,
  });

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
      await loadInstagramBrowserCookies(
        cookiesFile,
      );

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForTimeout(8_000);

    const collected =
      new Map<string, string>();

    for (
      let round = 0;
      round < 12;
      round += 1
    ) {
      if (signal?.aborted) {
        throw new Error(
          'Đã hủy tải album Instagram.',
        );
      }

      const imageUrls =
        await page.evaluate(() =>
          Array.from(
            document.querySelectorAll<HTMLImageElement>(
              'img',
            ),
          )
            .filter(
              (image) =>
                (
                  image.currentSrc ||
                  image.src
                ).includes(
                  'cdninstagram.com',
                ) &&
                image.naturalWidth >= 500 &&
                image.naturalHeight >= 500,
            )
            .map(
              (image) =>
                image.currentSrc ||
                image.src,
            ),
        );

      for (const imageUrl of imageUrls) {
        collected.set(
          imageUrl.split('?')[0],
          imageUrl,
        );
      }

      const clicked =
        await page.evaluate(() => {
          const button =
            document.querySelector<HTMLButtonElement>(
              'button[aria-label="Next"]',
            );

          if (!button) {
            return false;
          }

          button.click();
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
        'Không tìm thấy ảnh trong bài Instagram.',
      );
    }

    for (
      let index = 0;
      index < imageUrls.length;
      index += 1
    ) {
      if (signal?.aborted) {
        throw new Error(
          'Đã hủy tải album Instagram.',
        );
      }

      const response =
        await context.request.get(
          imageUrls[index],
          {
            headers: {
              Referer: url,
            },
            timeout: 120_000,
          },
        );

      if (!response.ok()) {
        throw new Error(
          `Không tải được ảnh ${index + 1}/${imageUrls.length}: HTTP ${response.status()}.`,
        );
      }

      const contentType =
        response.headers()['content-type'] ||
        '';

      const extension =
        contentType.includes('png')
          ? 'png'
          : contentType.includes('webp')
            ? 'webp'
            : 'jpg';

      const fileName =
        `${String(index + 1).padStart(3, '0')}.${extension}`;

      await fs.writeFile(
        path.join(
          albumDirectory,
          fileName,
        ),
        await response.body(),
      );

      onProgress?.({
        percentage:
          ((index + 1) /
            imageUrls.length) *
          90,
        speed: 'Đang tải ảnh',
        eta:
          `${imageUrls.length - index - 1} ảnh`,
      });
    }

    onProgress?.({
      percentage: 95,
      speed: 'Đang đóng gói ZIP',
      eta: '--:--',
    });

    const zipResult = await execa(
      'zip',
      ['-r', '-q', zipPath, '.'],
      {
        cwd: albumDirectory,
        reject: false,
      },
    );

    if (zipResult.exitCode !== 0) {
      throw new Error(
        'Không thể đóng gói album Instagram thành ZIP.',
      );
    }

    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    onProgress?.({
      percentage: 100,
      speed: 'Hoàn tất',
      eta: '00:00',
    });

    return {
      filePath: zipPath,
      fileName: path.basename(zipPath),
    };
  } catch (error) {
    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    throw error;
  } finally {
    await browser.close();
  }
}

async function downloadTikTokPhotoAlbum(
  options: DownloadMediaOptions,
): Promise<DownloadResult> {
  const {
    url,
    outputDirectory,
    fileNameTemplate,
    signal,
    onProgress,
  } = options;

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const baseName = sanitizeFileName(
    fileNameTemplate || 'tiktok_album',
  );

  const resolvedOutputDirectory =
    path.resolve(outputDirectory);

  const albumDirectory = path.join(
    resolvedOutputDirectory,
    `${baseName}_images`,
  );

  const zipPath = path.join(
    resolvedOutputDirectory,
    `${baseName}.zip`,
  );

  await fs.rm(albumDirectory, {
    recursive: true,
    force: true,
  });

  await fs.rm(zipPath, {
    force: true,
  });

  await fs.mkdir(albumDirectory, {
    recursive: true,
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  try {
    if (signal?.aborted) {
      throw new Error('Đã hủy tải album.');
    }

    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1000,
      },
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 120_000,
    });

    await page.waitForTimeout(10_000);

    if (signal?.aborted) {
      throw new Error('Đã hủy tải album.');
    }

    const rawImageUrls = await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .map((image) => {
            const htmlImage =
              image as HTMLImageElement;

            return (
              htmlImage.currentSrc ||
              htmlImage.src
            );
          })
          .filter(
            (imageUrl) =>
              imageUrl.includes('photomode') &&
              (
                imageUrl.includes('tiktokcdn') ||
                imageUrl.includes('muscdn')
              ),
          ),
      );

    const imageUrls = Array.from(
      new Map(
        rawImageUrls.map((imageUrl) => [
          imageUrl.split('?')[0],
          imageUrl,
        ]),
      ).values(),
    );

    if (imageUrls.length === 0) {
      throw new Error(
        'Không tìm thấy ảnh trong bài TikTok. Trang có thể đang yêu cầu CAPTCHA.',
      );
    }

    for (
      let index = 0;
      index < imageUrls.length;
      index += 1
    ) {
      if (signal?.aborted) {
        throw new Error('Đã hủy tải album.');
      }

      const imageUrl = imageUrls[index];

      const response = await context.request.get(
        imageUrl,
        {
          headers: {
            Referer: url,
          },
          timeout: 120_000,
        },
      );

      if (!response.ok()) {
        throw new Error(
          `Không tải được ảnh ${index + 1}/${imageUrls.length}: HTTP ${response.status()}.`,
        );
      }

      const contentType =
        response.headers()['content-type'] ||
        '';

      const extension =
        contentType.includes('png')
          ? 'png'
          : contentType.includes('webp')
            ? 'webp'
            : 'jpg';

      const fileName =
        `${String(index + 1).padStart(3, '0')}.${extension}`;

      const filePath = path.join(
        albumDirectory,
        fileName,
      );

      await fs.writeFile(
        filePath,
        await response.body(),
      );

      onProgress?.({
        percentage:
          ((index + 1) / imageUrls.length) *
          90,
        speed: 'Đang tải ảnh',
        eta:
          `${imageUrls.length - index - 1} ảnh`,
      });
    }

    if (signal?.aborted) {
      throw new Error('Đã hủy tải album.');
    }

    onProgress?.({
      percentage: 95,
      speed: 'Đang đóng gói ZIP',
      eta: '--:--',
    });

    const zipResult = await execa(
      'zip',
      [
        '-q',
        '-r',
        zipPath,
        '.',
      ],
      {
        cwd: albumDirectory,
        cancelSignal: signal,
        reject: false,
      },
    );

    if (zipResult.exitCode !== 0) {
      throw new Error(
        zipResult.stderr ||
        'Không thể đóng gói album thành file ZIP.',
      );
    }

    await fs.access(zipPath);

    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    onProgress?.({
      percentage: 100,
      speed: 'Hoàn tất',
      eta: '00:00',
    });

    return {
      filePath: path.resolve(zipPath),
      fileName: path.basename(zipPath),
    };
  } catch (error) {
    await fs.rm(albumDirectory, {
      recursive: true,
      force: true,
    });

    throw error;
  } finally {
    await browser.close();
  }
}

export async function downloadMedia(
  options: DownloadMediaOptions,
): Promise<DownloadResult> {
  const {
    url,
    outputDirectory,
    fileNameTemplate,
    audioOnly = false,
    cookiesFile,
    signal,
    onProgress,
  } = options;

  if (isTikTokPhotoUrl(url)) {
    return downloadTikTokPhotoAlbum(options);
  }

  if (isInstagramPostUrl(url)) {
    return downloadInstagramPhotoAlbum(options);
  }

  if (isFacebookPhotoUrl(url)) {
    return downloadFacebookPhotoAlbum(options);
  }

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const baseName = sanitizeFileName(
    fileNameTemplate || '%(title).160B',
  );

  const outputTemplate = path.join(
    outputDirectory,
    `${baseName}.%(ext)s`,
  );

  const progressPrefix = '__SOCIALDOWNLOADER_PROGRESS__';
  const filePrefix = '__SOCIALDOWNLOADER_FILE__';

  const args: string[] = [
    '--no-playlist',
    '--newline',
    '--no-warnings',
    '--continue',
    '--part',
    '--output',
    outputTemplate,
    '--progress-template',
    `${progressPrefix}|%(progress._percent_str)s|%(progress.speed)s|%(progress.eta)s|%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s`,
    '--print',
    `after_move:${filePrefix}%(filepath)s`,
  ];

  if (audioOnly) {
    args.push(
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
    );
  } else {
    args.push(
      '--format',
      'bestvideo*+bestaudio/best',
      '--merge-output-format',
      'mp4',
    );
  }

  addPlatformArguments(
    args,
    url,
  );

  const resolvedCookiesFile = path.resolve(
    cookiesFile ||
    process.env.YT_DLP_COOKIES ||
    'secrets/cookies.txt',
  );

  try {
    await fs.access(resolvedCookiesFile);
    args.push('--cookies', resolvedCookiesFile);
  } catch {
    // Continue without cookies for platforms that do not require login.
  }

  args.push(url);

  let finalFilePath = '';
  let pendingOutput = '';

  const subprocess = execa(YT_DLP_BINARY, args, {
    cancelSignal: signal,
    reject: false,
    all: true,
    maxBuffer: 50 * 1024 * 1024,
  });

  subprocess.all?.on('data', (chunk: Buffer | string) => {
    pendingOutput += chunk.toString();

    const lines = pendingOutput.split(/\r?\n/);
    pendingOutput = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      if (line.startsWith(progressPrefix)) {
        const [
          ,
          rawPercentage,
          rawSpeed,
          rawEta,
          rawDownloadedBytes,
          rawTotalBytes,
        ] = line.split('|');

        const percentage = Number.parseFloat(
          (rawPercentage || '0')
            .replace('%', '')
            .trim(),
        );

        onProgress?.({
          percentage: Number.isFinite(percentage)
            ? Math.min(Math.max(percentage, 0), 100)
            : 0,
          speed:
            rawSpeed && rawSpeed !== 'NA'
              ? rawSpeed.trim()
              : '0 B/s',
          eta:
            rawEta && rawEta !== 'NA'
              ? rawEta.trim()
              : '--:--',
          downloadedBytes: parseNumber(rawDownloadedBytes),
          totalBytes: parseNumber(rawTotalBytes),
        });
      }

      if (line.startsWith(filePrefix)) {
        finalFilePath = line
          .slice(filePrefix.length)
          .trim();
      }
    }
  });

  const result = await subprocess;

  if (result.exitCode !== 0) {
    const errorText =
      result.all ||
      result.stderr ||
      'yt-dlp kết thúc với lỗi không xác định.';

    throw new Error(
      errorText
        .toString()
        .trim()
        .slice(-3000),
    );
  }

  if (!finalFilePath && pendingOutput.includes(filePrefix)) {
    finalFilePath = pendingOutput
      .slice(pendingOutput.indexOf(filePrefix) + filePrefix.length)
      .trim();
  }

  if (!finalFilePath) {
    throw new Error(
      'Đã chạy yt-dlp nhưng không xác định được file đầu ra.',
    );
  }

  const resolvedPath = path.resolve(finalFilePath);

  await fs.access(resolvedPath);

  return {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
  };
}

export interface LegacyDownloadOptions {
  output: string;
  format?: string;
  cookies?: string;
  proxy?: string;
}

export interface LegacyYtDlpResult {
  stdout: string;
  stderr: string;
}

export async function runYtDlp(
  url: string,
  options: LegacyDownloadOptions,
  onProgress?: (line: string) => void,
): Promise<LegacyYtDlpResult> {
  const args: string[] = [
    '--newline',
    '--no-playlist',
  ];

  if (options.format) {
    args.push('-f', options.format);
  }

  if (options.cookies) {
    args.push('--cookies', options.cookies);
  }

  if (options.proxy) {
    args.push('--proxy', options.proxy);
  }

  args.push(
    '-o',
    options.output,
    url,
  );

  let stdout = '';
  let stderr = '';

  const subprocess = execa(YT_DLP_BINARY, args, {
    reject: false,
  });

  subprocess.stdout?.on('data', (data: Buffer | string) => {
    const line = data.toString();
    stdout += line;
    onProgress?.(line);
  });

  subprocess.stderr?.on('data', (data: Buffer | string) => {
    const line = data.toString();
    stderr += line;
    onProgress?.(line);
  });

  const result = await subprocess;

  if (result.exitCode !== 0) {
    throw new Error(
      stderr.trim() ||
      stdout.trim() ||
      'yt-dlp kết thúc với lỗi không xác định.',
    );
  }

  return {
    stdout,
    stderr,
  };
}
