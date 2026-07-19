import { DownloadTask } from "../types/task";

const queue: DownloadTask[] = [];

export function addTask(url: string): DownloadTask {

    const task: DownloadTask = {

        id: crypto.randomUUID(),

        url,

        status: "pending",

        progress: 0,

        createdAt: Date.now(),

        updatedAt: Date.now()

    };

    queue.push(task);

    return task;

}

export function getQueue() {

    return queue;

}

export function getNextTask() {

    return queue.find(t => t.status === "pending");

}

export function updateTask(
    id: string,
    data: Partial<DownloadTask>
) {

    const task = queue.find(t => t.id === id);

    if (!task) return;

    Object.assign(task, data);

    task.updatedAt = Date.now();

}