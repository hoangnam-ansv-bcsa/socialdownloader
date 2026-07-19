import { getNextTask, updateTask } from "./queue";
import { download } from "./download";

let started = false;

const MAX_WORKERS = 4;

async function workerLoop(workerId: number) {

    while (true) {

        const task = getNextTask();

        if (!task) {

            await new Promise(resolve => setTimeout(resolve,1000));

            continue;

        }

        updateTask(task.id,{
            status:"downloading",
            progress:0
        });

        console.log(`[Worker ${workerId}] ${task.url}`);

        try{

            await download(task.url);

            updateTask(task.id,{
                status:"completed",
                progress:100
            });

        }catch(error){

            updateTask(task.id,{
                status:"failed"
            });

            console.error(error);

        }

    }

}

export function startWorkers(){

    if(started) return;

    started=true;

    for(let i=1;i<=MAX_WORKERS;i++){

        workerLoop(i);

    }

}