import { execa } from "execa";

export interface DownloadOptions {
  output: string;
  format?: string;
  cookies?: string;
  proxy?: string;
}

export interface YtDlpResult {
  stdout: string;
  stderr: string;
}

export async function runYtDlp(
  url: string,
  options: DownloadOptions,
  onProgress?: (line: string) => void
): Promise<YtDlpResult> {

  const args: string[] = [
    "--newline",
    "--ignore-errors",
    "--no-playlist",
  ];

  if (options.format) {
    args.push("-f", options.format);
  }

  if (options.cookies) {
    args.push("--cookies", options.cookies);
  }

  if (options.proxy) {
    args.push("--proxy", options.proxy);
  }

  args.push(
    "-o",
    options.output,
    url
  );

  let stdout = "";
  let stderr = "";

  const subprocess = execa("yt-dlp", args);

  subprocess.stdout?.on("data", (data) => {

    const line = data.toString();

    stdout += line;

    onProgress?.(line);

  });

  subprocess.stderr?.on("data", (data) => {

    const line = data.toString();

    stderr += line;

    onProgress?.(line);

  });

  await subprocess;

  return {
    stdout,
    stderr,
  };

}