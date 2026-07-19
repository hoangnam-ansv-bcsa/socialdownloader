export type DownloadStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed";

export interface DownloadTask {
  id: string;

  url: string;

  status: DownloadStatus;

  progress: number;

  title?: string;

  filename?: string;

  error?: string;

  createdAt: number;

  updatedAt: number;
}