import { downloadVideo } from "./downloadService";
import {
    getNextTask,
    updateTask,
} from "./queueService";

let running = false;

export async function startWorker() {

    if (running) return;

    running = true;

    while (true) {

        const task = getNextTask();

        if (!task) {

            await new Promise(r => setTimeout(r,1000));

            continue;

        }

        updateTask(task.id,{
            status:"downloading",
            progress:0
        });

        try{

            await downloadVideo(task.url);

            updateTask(task.id,{
                status:"completed",
                progress:100
            });

        }catch{

            updateTask(task.id,{
                status:"failed"
            });

        }

    }

}