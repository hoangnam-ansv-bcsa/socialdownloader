import crypto from "crypto";

export type DownloadTask = {
  id: string;
  url: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  createdAt: number;
};

const queue: DownloadTask[] = [];

export function addTask(url: string) {
  const task: DownloadTask = {
    id: crypto.randomUUID(),
    url,
    status: "pending",
    progress: 0,
    createdAt: Date.now(),
  };

  queue.push(task);

  return task;
}

export function getQueue() {
  return queue;
}

export function getNextTask() {
  return queue.find(task => task.status === "pending");
}

export function updateTask(id: string, data: Partial<DownloadTask>) {
  const task = queue.find(t => t.id === id);

  if (!task) return;

  Object.assign(task, data);
}