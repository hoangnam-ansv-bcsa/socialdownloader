import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

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

export async function getMediaMetadata(
  url: string,
): Promise<YtDlpMetadata> {
  const metadataArgs = [
    '--dump-single-json',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes',
    'node',
    '--remote-components',
    'ejs:github',
  ];

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
    '--js-runtimes',
    'node',
    '--remote-components',
    'ejs:github',
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
