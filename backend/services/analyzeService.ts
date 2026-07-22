import { execa } from "execa";
import { randomUUID } from "crypto";
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
}

function formatDuration(seconds?: number): string {

  if (!seconds) return "";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return [
      h.toString().padStart(2, "0"),
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ].join(":");
  }

  return [
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0"),
  ].join(":");
}

export async function analyzeUrl(
  url: string
): Promise<AnalyzeResult> {

  const { stdout } = await execa("yt-dlp", [
    "--dump-single-json",
    "--no-playlist",
    url,
  ]);

  const data = JSON.parse(stdout);

  return {

    id: randomUUID(),

    url,

    platform: data.extractor || "Unknown",

    title: data.title || "Unknown",

    author: data.uploader || data.channel || "Unknown",

    thumbnail: data.thumbnail || "",

    duration: formatDuration(data.duration),

    resolution:
      data.width && data.height
        ? `${data.height}p`
        : "",

    estimatedSize:
      data.filesize ||
      data.filesize_approx ||
      0,

  };

}